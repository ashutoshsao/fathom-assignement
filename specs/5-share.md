# 5 — Share

## Goal

Send a call, or one moment from it, to somebody who was not there. Also the cheapest possible proof
that the live link genuinely opens for a stranger — the brief's final checklist item.

## Contract

- A **public `/share/[id]`** view that renders with no session and no auth.
- Share a **whole call** or a **clip** around a highlighted moment.
- The shared view is deliberately reduced: playback, transcript, summary. No settings, no Ask
  across the owner's other calls.

## Progress

- [x] **Public `/share/[id]`**, verified in a test context with no cookies or storage — the
      closest the harness gets to "somebody who is not signed in", which is the brief's final
      check. Prerendered per call.
- [x] **Share a whole call** — playback, summary and transcript, nothing else.
- [x] **Share a clip** via `?clip=<start>-<end>`. The clip genuinely behaves like one: it opens at
      the start, the transcript shows only that window, and playback is clamped so it stops at the
      end instead of running on into the rest of an hour-long call the recipient was never sent.
      A malformed range falls back to the whole call rather than rendering an empty window.
- [x] **Share menu on the call page** with three options — whole call, from this moment, or a
      60-second clip around it — each copying a link, and saying that no account is needed.

## What this milestone actually taught

- **"Share a call" is rarely what people mean.** Usually it is "listen to this bit", and making
  someone scrub an hour to find it is how a shared link gets ignored. The clip option is the one
  that earns its place; the whole-call link is the fallback.
- **The reduced view is a product decision, not a subset.** A recipient gets the recording and
  what it meant, and is deliberately denied the owner's other meetings, their search, and
  cross-call Ask. Tested explicitly, because leaking a library into a public link would be a real
  privacy failure rather than a cosmetic one.
- **A test failure caught a behaviour change, correctly.** Adding auto-resume meant a recording
  left "processing" no longer stays that way — the earlier test had to hold the transcription
  open to observe the state at all. The suite noticing this is the point of having it.
