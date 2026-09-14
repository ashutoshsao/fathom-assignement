# 4 — Capture (real, not simulated)

## Goal

Record an actual meeting and put it through the real pipeline, so that nothing in this product is
stubbed end to end.

The brief permits faking the capture layer. We are not taking that allowance, because the
alternative turned out to be reachable: a browser can capture a meeting tab's audio and the
microphone together, which is both genuinely real and closer to where the product itself went —
Fathom's own newer desktop app is bot-free local capture, not a bot that joins the call.

## What we are deliberately NOT building, and why

A **bot that joins the meeting as a participant** needs a headless browser with a virtual audio
device, a Google account that survives Meet's bot detection, and a long-running server with
persistent disk. None of that runs on Vercel, which is where the live link lives. It is days of
fragile work for a capability the brief explicitly says not to bother with.

## Contract

- A **Record** surface that captures a shared tab's audio **and** the microphone, mixed, so both
  sides of a call are recorded.
- A **live recording state**: elapsed timer, stop, and a mark-highlight button.
- On stop, the recording goes through the **same pipeline as the seed data** — Gemini for a
  diarized timestamped transcript, then the summary/action-items pass.
- The result is a **real call record**: player, synced transcript, summary, action items, and Ask
  over it. Indistinguishable in capability from a seeded call.
- Recorded calls appear **in the library** alongside the seeded ones, marked as locally recorded.
- The **limitations are stated in the UI**, not buried: Chrome/Edge only, stored in this browser.
- Nothing regresses: full suite green.

## Decisions

- **Storage is the reviewer's browser (IndexedDB).** There is no database and no blob store, by an
  earlier decision that still holds. A recording is personal to whoever made it, which is also the
  honest behaviour — it should not appear in a stranger's library.
- **Timestamps come from the model here, unlike the seed data.** There is no Whisper pass for a
  fresh recording. We learned on long audio that model timestamps drift badly (a 35-minute slice
  returned turns at 57 minutes), so recordings are kept short by design and the UI says so. This
  is the one place the timestamp spine is model-generated, and it is a deliberate, bounded
  exception.
- **Two requests per recording**, not one: audio → transcript, then transcript → notes. Reuses the
  prompts already proven on the seed data rather than inventing a combined schema.
- **Tab audio, not system audio.** The user picks the meeting tab in the browser's share dialog.
  One extra click a native app would not need, and worth naming rather than hiding.

## Progress

- [ ] Client recorder: getDisplayMedia (tab audio) + getUserMedia (mic), mixed via Web Audio
- [ ] Recording UI: arm, live timer, stop, mark highlight, honest browser-support notice
- [ ] `/api/transcribe`: audio → Gemini → diarized timestamped transcript
- [ ] Reuse the notes pass to produce summary + action items for a recording
- [ ] IndexedDB store for recorded audio + call records
- [ ] Recorded calls render through the existing CallView (player, transcript, summary, Ask)
- [ ] Recorded calls listed in the library, marked as local
- [ ] Tests: recorder state machine, storage round-trip, recorded call renders
- [ ] Full suite green
