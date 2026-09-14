"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { segmentIndexAt } from "@/lib/time";
import type { TranscriptSegment } from "@/lib/types";

/**
 * One audio element, shared by everything that cares about the timeline.
 *
 * The obvious version — put `currentTime` in context state — re-renders every consumer roughly
 * four times a second. With 2,326 transcript rows on screen that is a page which stutters while
 * the audio plays, and it is the single easiest way to make this product feel broken.
 *
 * So time lives in a ref and is published through a subscription. Components choose what they
 * actually need: the player needs the ticking number, the transcript only needs "which line is
 * active", which changes a few times a minute rather than four times a second.
 */

interface PlaybackStore {
  subscribe: (fn: () => void) => () => void;
  getTime: () => number;
  getDuration: () => number;
  getPlaying: () => boolean;
  getRate: () => number;
  seek: (sec: number) => void;
  toggle: () => void;
  play: () => void;
  setRate: (rate: number) => void;
  skip: (delta: number) => void;
  audio: () => HTMLAudioElement | null;
}

const Ctx = createContext<PlaybackStore | null>(null);

export function PlaybackProvider({
  src,
  startAt,
  children,
}: {
  src: string;
  /** Seconds to open at — used by deep links, so a cross-call citation lands on the moment. */
  startAt?: number;
  children: ReactNode;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const listeners = useRef(new Set<() => void>());
  const state = useRef({ time: 0, duration: 0, playing: false, rate: 1 });

  const emit = useCallback(() => {
    for (const fn of listeners.current) fn();
  }, []);

  const store = useMemo<PlaybackStore>(() => ({
    subscribe: (fn) => {
      listeners.current.add(fn);
      return () => listeners.current.delete(fn);
    },
    getTime: () => state.current.time,
    getDuration: () => state.current.duration,
    getPlaying: () => state.current.playing,
    getRate: () => state.current.rate,
    audio: () => audioRef.current,
    seek: (sec) => {
      const el = audioRef.current;
      if (!el) return;
      el.currentTime = Math.max(0, sec);
      // Update immediately rather than waiting for the next timeupdate, so a click on a
      // transcript line moves the highlight without a visible lag.
      state.current.time = Math.max(0, sec);
      emit();
    },
    play: () => void audioRef.current?.play(),
    toggle: () => {
      const el = audioRef.current;
      if (!el) return;
      if (el.paused) void el.play();
      else el.pause();
    },
    setRate: (rate) => {
      const el = audioRef.current;
      if (!el) return;
      el.playbackRate = rate;
      state.current.rate = rate;
      emit();
    },
    skip: (delta) => {
      const el = audioRef.current;
      if (!el) return;
      el.currentTime = Math.max(0, Math.min(el.duration || Infinity, el.currentTime + delta));
      state.current.time = el.currentTime;
      emit();
    },
  }), [emit]);

  // A deep link can only seek once the browser knows how long the audio is, so wait for metadata.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !startAt) return;
    const apply = () => {
      el.currentTime = startAt;
      state.current.time = startAt;
      emit();
    };
    if (el.readyState >= 1) apply();
    else el.addEventListener("loadedmetadata", apply, { once: true });
    return () => el.removeEventListener("loadedmetadata", apply);
  }, [startAt, emit]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      state.current.time = el.currentTime;
      emit();
    };
    const onMeta = () => {
      state.current.duration = el.duration || 0;
      emit();
    };
    const onPlayPause = () => {
      state.current.playing = !el.paused;
      emit();
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onMeta);
    el.addEventListener("play", onPlayPause);
    el.addEventListener("pause", onPlayPause);
    el.addEventListener("ended", onPlayPause);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onMeta);
      el.removeEventListener("play", onPlayPause);
      el.removeEventListener("pause", onPlayPause);
      el.removeEventListener("ended", onPlayPause);
    };
  }, [emit]);

  // Space to play/pause, arrows to scrub — the shortcuts anyone who has used a player expects.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === " ") {
        e.preventDefault();
        store.toggle();
      } else if (e.key === "ArrowLeft") {
        store.skip(-10);
      } else if (e.key === "ArrowRight") {
        store.skip(10);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);

  return (
    <Ctx.Provider value={store}>
      <audio ref={audioRef} src={src} preload="metadata" />
      {children}
    </Ctx.Provider>
  );
}

export function usePlayback(): PlaybackStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlayback must be used inside PlaybackProvider");
  return ctx;
}

/** For components that render both inside and outside a player — the Ask panel, for instance. */
export function usePlaybackOptional(): PlaybackStore | null {
  return useContext(Ctx);
}

/** The ticking clock. Only use where the number is actually displayed. */
export function useCurrentTime(): number {
  const store = usePlayback();
  return useSyncExternalStore(store.subscribe, store.getTime, () => 0);
}

export function useDuration(): number {
  const store = usePlayback();
  return useSyncExternalStore(store.subscribe, store.getDuration, () => 0);
}

export function useIsPlaying(): boolean {
  const store = usePlayback();
  return useSyncExternalStore(store.subscribe, store.getPlaying, () => false);
}

export function useRate(): number {
  const store = usePlayback();
  return useSyncExternalStore(store.subscribe, store.getRate, () => 1);
}

/**
 * Which transcript line is playing.
 *
 * Returns an index, not a time, so subscribers re-render when the *line* changes — a few times a
 * minute — instead of on every tick. This is what keeps a 2,326-row transcript smooth.
 */
export function useActiveSegment(segments: TranscriptSegment[]): number {
  const store = usePlayback();
  const getSnapshot = useCallback(
    () => segmentIndexAt(segments, store.getTime()),
    [segments, store],
  );
  return useSyncExternalStore(store.subscribe, getSnapshot, () => -1);
}
