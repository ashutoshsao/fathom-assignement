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

- [x] **Client recorder**: `getDisplayMedia` for tab audio + `getUserMedia` for the mic, mixed
      through Web Audio into one track. Both are needed — tab audio alone records everyone except
      you, the mic alone records only you. Video is requested and discarded, because Chrome will
      not offer tab-audio sharing for an audio-only request.
- [x] **Recording UI**: arm, live timer, stop, mark-highlight, and the limits stated up front
      rather than discovered. The browser's own "Stop sharing" bar also ends the recording.
- [x] **`/api/transcribe`**: audio → Files API → Gemini → diarized timestamped transcript.
- [x] **Notes pass reused** to produce summary, takeaways and action items for a recording.
- [x] **IndexedDB store** for the audio blob and the call record; reads degrade to empty rather
      than throwing, because private windows and blocked storage are normal.
- [x] **Recorded calls render through the existing CallView** — the same player, transcript,
      summary and Ask as a seeded call. Only the audio source differs (a blob URL).
- [x] **Listed in the library**, marked "only visible to you", with delete.
- [x] **Tests**: 8 unit tests on the assembly (index→timestamp resolution, unknown assignee
      becomes unassigned rather than the wrong person, out-of-range index does not crash), plus
      integration tests for the entry point, the missing-recording state, and a stored recording
      rendering through the call UI.
- [x] **Full suite green**: 35 unit, 17 integration.

## Verified end to end

A 40-second clip posted to `/api/transcribe` came back with a correct transcript, a title
("HPR Website Static Site & CDN"), a blurb and three grounded takeaways. The transcription was
*better* than the Whisper output shipped with the seed data — it resolved "anonymoushost.com who
Josh Knapp" where Whisper had mangled it.

## Known weakness, stated rather than hidden

**Speaker separation is weaker on short clips.** The same 40 seconds that the full-call casting
pass split into two alternating voices came back as one speaker. Diarization benefits from
hearing a whole conversation, which a fresh recording cannot offer. For a two-minute test call
between two people this is usually fine, and the failure mode is benign — fewer speakers, not
wrong words — but it is a real difference from the seeded calls and should be said out loud in
the walkthrough.
