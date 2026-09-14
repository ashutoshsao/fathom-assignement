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
- **Gemini does diarization, not transcription.** *Revised once the source was found.* The original
  plan was Gemini for the whole transcription pass, because Whisper gives no speaker labels. But HPR
  publishes its own Whisper output (timestamped segments) alongside every episode under the same
  licence — so STT is already done, free, and costs none of the clock. Gemini's job narrowed to
  attaching speakers to those existing segments. Gemini's own transcription text is *better*, but
  LLM-generated timestamps drift, and timestamps are this product's spine — click-to-seek,
  scroll-sync and every Ask citation resolve to them. Machine-accurate timing beats nicer wording.

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

- [x] **`apps/web` converted to Next.js App Router; `apps/docs` removed.** Next 16.3.5 + React 19 +
      Tailwind 4, turbo build green. The half-finished Vite conversion was replaced rather than
      extended; `apps/docs` was untouched `create-turbo` boilerplate.

- [x] **Audio sourced**, attribution and required CC change-disclosure in `content/seed/SOURCES.md`.
      Five calls, 6h02m, all CC BY-SA from Hacker Public Radio, 83MB shipped after transcoding to
      mono 32kbps. Four are *HPR Community News* — a real monthly team meeting held over Mumble, so
      the library is one team's recurring meeting across four months rather than four unrelated
      calls, which makes cross-call Ask genuinely useful. The fifth, `hpr4314`, is the stress case.

- [x] **Speech-to-text — solved for free, not built.** HPR publishes Whisper output next to each
      episode, so the timestamped segment spine cost nothing. See the revised decision above.

- [x] **The many-speaker stress case found**, after first getting it wrong. An initial pass
      concluded nothing free had 8 voices *and* a transcript; that was based on sampling HPR's
      2019-era NYE marathons, which predate them publishing transcripts. The 2024-25 ones ship SRT.
      `hpr4314` is 1h49m of large unstructured group call with heavy crosstalk and no introductions.

- [x] **Gemini viability proven on real audio, not assumed.** Measured on this key: audio costs
      exactly 32 tokens/sec; a 2-minute slice of the hard call diarized correctly into 3 distinct
      voices in 15s. A full diarization pass over all five calls is ~750k tokens across ~30 chunked
      requests — comfortably inside the free tier, whose binding constraint is TPM per minute, not
      volume. No billing needed for this assignment.

- [ ] Tailwind v4 + shadcn, **dark theme tokens, fonts** — Tailwind came with the scaffold; the
      design system itself is not started.
- [ ] Data model landed as TypeScript types + a seed loader
- [ ] **Diarization pipeline**: chunked audio + existing segments → Gemini → speaker-labelled
      transcript JSON, with speaker identities reconciled across chunks
- [ ] Summary + action items pipeline (structured output)
- [ ] Seed set complete and committed to `content/seed/`
- [ ] Deploys to Vercel from a clean build — **blocked**: needs the repo pushed and Vercel connected

## Also decided during M0 (recorded here, detail in the specs they belong to)

- **No vector RAG for Ask.** Measured: the whole library is 71,424 tokens, 6.8% of one context
  window. See `2-ask.md`.
