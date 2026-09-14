# 0 — Foundation

## Goal

Get from a half-converted Turborepo scaffold to a deployable Next.js app with a design system, a
data model, and **real seed data produced by a real pipeline**. Nothing user-facing ships here, but
every later milestone is blocked on it — especially the seed data, whose slowest part (sourcing and
transcribing an hour of multi-speaker audio) should start early and run while other work proceeds.

## Contract

- `apps/web` is a Next.js App Router app that builds clean and deploys to Vercel.
- A dark-first Tailwind v4 + shadcn foundation with the type scale and colour tokens settled.
- `content/seed/` holds committed JSON for a set of calls, each with a diarized, timestamped
  transcript, a summary, and action items.
- At least one seeded call is long and multi-speaker (~8 speakers, ~1 hour) with real audio.
- `scripts/` holds the pipeline that produced that data, runnable and documented, so the data is
  reproducible rather than hand-faked.

## Decisions

- **Replace the Vite conversion, don't extend it.** The working tree has a half-done Vite migration
  of `apps/web`. Next.js on Vercel is the locked stack; carrying both is worse than picking one.
- **Delete `apps/docs`.** It is unmodified `create-turbo` boilerplate and contributes nothing.
- **Audio: open-licensed real recordings.** Chosen over TTS for realism. The risk is that sourcing
  is an unbounded time sink, so it is **timeboxed to 30 minutes** — if nothing suitable is found in
  that window, fall back to TTS for the long call and say so here.
- **Gemini does transcription, not Whisper.** Whisper returns word timestamps but no speaker
  diarization, and speaker attribution is the whole point of the long call.

## Data model (draft)

```
Call
  id, title, startedAt, durationSec, platform ('google-meet' | 'zoom' | 'teams')
  participants: [{ id, name, initials, colour }]
  audioUrl, waveform: number[]
  summary:     { purpose, keyTakeaways[], topics[{ heading, points[] }], nextSteps[] }
  actionItems: [{ id, text, assigneeId, atSec }]
  transcript:  [{ id, speakerId, startSec, endSec, text }]
  highlights:  [{ id, atSec, label }]
```

`atSec` / `startSec` are the spine of the product: the player, the transcript, the action items,
the highlights and every Ask citation all address the same timeline in seconds.

## Progress

- [ ] `apps/web` converted to Next.js App Router; `apps/docs` removed
- [ ] Tailwind v4 + shadcn, dark theme tokens, fonts
- [ ] Data model landed as TypeScript types + a seed loader
- [ ] Audio sourced (open-licensed, attribution recorded in `content/seed/SOURCES.md`)
- [ ] Transcription pipeline: audio → Gemini → diarized timestamped transcript JSON
- [ ] Summary + action items pipeline (structured output)
- [ ] Seed set complete, including the long multi-speaker call
- [ ] Deploys to Vercel from a clean build
