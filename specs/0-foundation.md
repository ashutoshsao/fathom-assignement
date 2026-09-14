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

- [x] **Dark theme tokens** in `globals.css` — dark-only, matching the real product; surfaces,
      hairlines, one accent, and an 8-colour speaker palette. shadcn not pulled in yet; the token
      layer is what the components actually need first.

- [x] **Data model + seed loader.** `lib/types.ts` (everything resolves to a position in seconds),
      `lib/seed.ts` (server-only, file-backed, index split from call records so drawing the
      library does not load a 2,326-segment transcript), `lib/dates.ts` (relative dates, so the
      seeded library never reads as abandoned), `lib/time.ts` (timeline maths).

- [x] **Tests.** Unit tests co-located (`lib/*.test.ts`, `bun test`, 27 passing) — including a
      check that the binary-search segment lookup agrees with a linear scan across a
      2,326-segment transcript. Integration workspace in `apps/tests` (Playwright).

- [x] **Diarization pipeline built and proven on the hardest call.** `hpr4314`: 9 speakers
      (8 named humans + the announcer), 1043 turns, **0 unattributed segments**, coverage to
      segment 2317/2325. Six approaches were needed; five failed *silently*, which is recorded in
      the script header because the failures are the useful part.

- [x] **Model rotation** (`scripts/gemini.py`) after hitting the real quota: 20 requests/day
      **per model**, not the 250-1500 published third-party figures suggested. Scoped per model,
      so requests rotate across a pool of ten flash-class models with failover on 429.

- [x] **Waveform peaks** precomputed at build time.

- [x] **Diarization run across all five calls** — every one with 0 unattributed segments.
- [x] **Summary + action items generated for all five calls** (`scripts/summarize.py`).
- [x] **Seed assembled** into `apps/web/content/` — five call records plus a light index.
- [ ] Deploys to Vercel — **deferred by choice**: we deploy once the output is worth showing,
      which overrides the "deploy early" decision in `6-deploy-walkthrough.md`.

## Also decided during M0 (recorded here, detail in the specs they belong to)

- **No vector RAG for Ask.** Measured: the whole library is 71,424 tokens, 6.8% of one context
  window. See `2-ask.md`.
