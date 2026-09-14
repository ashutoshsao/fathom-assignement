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

- [ ] Player: waveform, scrub, play/pause, skip, speed, current/total time
- [ ] Transcript tab: speaker grouping, timestamps, click-to-seek
- [ ] Playback → transcript sync, with manual-scroll escape hatch
- [ ] Summary tab rendering the real structured summary
- [ ] Action items tab, each seeking to its source moment
- [ ] Verified against the 8-speaker hour-long call, not just a short one
