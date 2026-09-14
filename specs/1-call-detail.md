# 1 — Call detail

## Goal

The page where the product's value actually lives: listen to a call, read what was said, and see
what it meant. Built first, before the shell or the nav, because everything else in Fathom exists
to get you here.

## Contract

- A call page with **Summary / Action Items / Transcript** tabs and a persistent audio player.
- The transcript **follows playback** — the active line is highlighted and stays in view.
- Clicking any transcript line **seeks the audio** to that moment.
- Speaker attribution is visible and legible at eight speakers, not just two.
- The **hour-long transcript stays smooth** — scrolling, seeking and following do not jank.
- Summary renders its real structure: purpose, key takeaways, topics, next steps.
- Action items are real, each carrying the timestamp it came from, and clicking one seeks there.

## Decisions

- **Sync is one-directional by default, with an escape hatch.** Playback drives the transcript; if
  the user scrolls away manually, following pauses and a "jump to current" affordance appears.
  Auto-scrolling a user away from what they are reading is the most common way this feature is
  ruined.
- **Virtualize the transcript** if the long call demands it, but measure first rather than reaching
  for a library on principle.

## Progress

- [x] **Player**: waveform scrubber from precomputed peaks, hover-time readout, play/pause,
      ±10s, speed, current/total. Keyboard: space, arrows.
- [x] **Transcript**: Whisper fragments grouped into speaker turns (one row per fragment read as
      noise, not conversation), per-speaker colour, click any line to seek.
- [x] **Playback → transcript sync, with the escape hatch.** Following pauses the moment you
      scroll; a "Jump to current" affordance opts back in.
- [x] **Summary tab** rendering the real structured summary, every takeaway and topic carrying
      the timestamp it was drawn from.
- [x] **Action items tab**, each seeking to its source moment, with an honest empty state for
      calls where nobody committed to anything.
- [x] **Verified against the 8-speaker hour-long call.** An integration test asserts all 2,326
      segments render, and that a cited timestamp puts the player within 2s of where it claims.

## What this milestone actually taught

- **Context state would have broken this.** Putting `currentTime` in React context re-renders
  every consumer ~4x/sec; with 2,326 rows that is a page that stutters while audio plays. Time
  lives in a ref published through a subscription, and the transcript subscribes to *which line
  is active* — a few changes a minute — rather than to the clock.
- **Two layout bugs were invisible to typecheck and unit tests**, and obvious in a screenshot: an
  empty flex pane stayed mounted behind the transcript tab and stole half the height, and the
  page scrolled instead of the transcript pane. This is the argument for `apps/tests` existing.
- **Integration tests must run against a production build.** `next dev` injects an HMR websocket
  that fails under the harness and reads as a console error.
