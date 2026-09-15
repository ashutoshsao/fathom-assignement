/**
 * Real meeting capture, in the browser.
 *
 * Captures the shared tab's audio AND the microphone, mixed into one track. Both matter: tab
 * audio alone records everyone except you, and the mic alone records only you. A meeting
 * recording that is missing half the conversation is worse than none.
 *
 * No bot joins the call. This is the same shape as Fathom's own bot-free desktop capture.
 */

export type RecorderState = "idle" | "requesting" | "recording" | "stopping";

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  durationSec: number;
  /** Seconds at which the user pressed "mark", relative to the recording start. */
  marks: number[];
}

export function isSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function" &&
    typeof window !== "undefined" &&
    typeof window.MediaRecorder === "function"
  );
}

/** Opus in WebM is what Chrome actually produces; Gemini accepts it. */
function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

export class MeetingRecorder {
  /**
   * Called when the BROWSER ends the capture rather than the app — the "Stop sharing" bar Chrome
   * puts over the page, or the shared tab being closed.
   *
   * Without this the class stopped its own MediaRecorder and told nobody, so the save-and-
   * transcribe path never ran and the recording was silently discarded. Ending a capture from
   * the browser's own control is the obvious thing for a user to do, so it has to be the same
   * code path as pressing Stop in the app.
   */
  onExternalStop: (() => void) | null = null;

  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private streams: MediaStream[] = [];
  private ctx: AudioContext | null = null;
  private startedAt = 0;
  private marks: number[] = [];

  /**
   * @param withMic capture the microphone as well as the tab. Off means "record what the others
   *                said"; on is the normal case.
   */
  async start(withMic = true): Promise<void> {
    if (!isSupported()) throw new Error("This browser cannot capture tab audio. Use Chrome or Edge.");

    // Video is requested because Chrome will not offer tab-audio sharing for an audio-only
    // request; the video track is discarded immediately.
    const display = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.streams.push(display);

    if (display.getAudioTracks().length === 0) {
      this.cleanup();
      throw new Error(
        'No tab audio was shared. Pick a tab and tick "Also share tab audio" in the dialog.',
      );
    }

    const ctx = new AudioContext();
    this.ctx = ctx;
    const destination = ctx.createMediaStreamDestination();
    ctx.createMediaStreamSource(new MediaStream(display.getAudioTracks())).connect(destination);

    if (withMic) {
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.streams.push(mic);
        ctx.createMediaStreamSource(mic).connect(destination);
      } catch {
        // Recording the far side only is still useful; refusing to record at all is not.
      }
    }

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(destination.stream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    this.marks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    recorder.start(1000);
    this.recorder = recorder;
    this.startedAt = Date.now();

    // The browser's own "Stop sharing" bar is a real way to end a recording, so honour it — by
    // handing control back to the app, not by quietly stopping and dropping the audio.
    display.getVideoTracks()[0]?.addEventListener("ended", () => {
      if (this.recorder?.state === "recording") this.onExternalStop?.();
    });
  }

  mark(): number {
    const at = this.elapsed();
    this.marks.push(at);
    return at;
  }

  elapsed(): number {
    return this.startedAt ? (Date.now() - this.startedAt) / 1000 : 0;
  }

  async stop(): Promise<RecordingResult> {
    const recorder = this.recorder;
    if (!recorder) throw new Error("not recording");
    const durationSec = this.elapsed();

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () =>
        resolve(new Blob(this.chunks, { type: recorder.mimeType || "audio/webm" }));
      recorder.stop();
    });

    this.cleanup();
    return { blob, mimeType: recorder.mimeType || "audio/webm", durationSec, marks: this.marks };
  }

  private cleanup() {
    for (const s of this.streams) for (const t of s.getTracks()) t.stop();
    this.streams = [];
    void this.ctx?.close();
    this.ctx = null;
    this.recorder = null;
  }
}
