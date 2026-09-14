# Fathom clone — project guide

Single source of truth for this build. Edit it as decisions change; it is not a snapshot.
Live status and per-milestone checklists live in `specs/`, not here.

## What this is

A 24-hour rebuild of [fathom.video](https://fathom.ai) — the AI meeting notetaker — for the 8x
assignment. Judged on **speed** (how much working product exists), **product judgement** (what was
built first and what was left out), and **UX/UI** (whether the thing is good to use).

Hard requirements from the brief:

- A **live deployed link** that opens for somebody not signed in.
- A **public repo** with `.agent-logs/` committed as work happens, not dumped at the end.
- A walkthrough video, camera on, under five minutes.
- **Seeded with real data.** An empty meetings list demonstrates nothing.

## The product being cloned

Three surfaces over one pipeline:

```
capture  (desktop app / browser overlay / meeting bot)
  → recording + timestamped transcript with speaker attribution
      → AI layer: summary, action items, highlights
          → retrieval: Ask, grounded in timestamps, over one call or all calls
```

- **Desktop app** — records the call, shows a "My Meetings" library.
- **Overlays** — a join prompt about a minute before a call starts, live recording controls, a
  post-call "summary ready" nudge.
- **Web app** — the same calls, with playback, summary, action items, transcript, Ask, sharing.

## The central decision

**A desktop app cannot be a live link.** So the web app is the deliverable, and the desktop and
overlay surfaces are built *inside it* as working simulations — a `/desktop` route with its own
window chrome, and overlays fired by a real scheduler over real seeded calendar data. Buttons
change real state. Not screenshots, not a video.

The brief explicitly permits this: *"You do not have to make the recording bot work. Faking or
stubbing the capture layer is a legitimate call."*

So the line is drawn sharply, and it is the most important rule in this repo:

> **The capture layer is stubbed. Everything downstream of capture is genuinely real.**

Real audio files. Real transcripts with real timestamps and real speaker labels. A real player the
transcript is synced to. Real LLM summaries and action items. Real Ask whose citations actually
seek the player. Nothing downstream of capture is a mock, because that is the part being judged.

## Stack (locked — don't re-litigate without new information)

| Area | Decision | Why |
|---|---|---|
| App | **Next.js (App Router)** in `apps/web`, replacing the Vite scaffold | One deploy, one live link. Route handlers keep the model API key server-side. |
| Runtime / monorepo | Bun + Turborepo | Pre-existing `create-turbo` scaffold |
| Hosting | **Vercel** | Zero-config for Next.js; the live link is the deliverable |
| Styling | **Tailwind v4** + shadcn/ui | Same foundation as `~/projects/orin`; fast and known |
| AI | **Gemini via `@google/genai`**, `GEMINI_API_KEY` | One provider covers all three needs: audio transcription *with speaker diarization* (Files API + `audioTimestamp` + `responseSchema`), structured summaries, and streamed Ask (`generateContentStream`). Whisper was rejected — no diarization, and an 8-person call needs it. |
| Data | **Seed JSON committed to the repo**, read server-side | No database. Nothing in this product needs durable multi-user writes in 24h, and a DB is 2 hours that buys the reviewer nothing. Revisit only if a feature genuinely requires writes surviving a redeploy. |
| Auth | **None.** Single seeded persona | The live link must open for a stranger. Auth is the one part nobody is judging and the one part that can fail the submission outright. |
| Theme | **Dark-first**, matching the real product | Every app screenshot of Fathom is dark |

## Repo layout

```
apps/web/              the whole product (Next.js)
  app/(app)/           browser app — library, call detail, settings
  app/desktop/         desktop-app surface simulation
  app/share/[id]/      public share view, no auth
  app/api/             route handlers (ask, and anything else server-side)
  content/seed/        committed seed data: calls, transcripts, summaries
  public/audio/        seed audio files
scripts/               one-off seed pipeline (source audio → Gemini → seed JSON)
specs/                 milestone specs, the live status of the build
.agent-logs/           automatic prompt/response capture (see CAPTURE-TEST.md)
```

## Seed data policy

Seed data is **generated once by a real pipeline and committed**, never produced at request time.
`scripts/` holds that pipeline: take an open-licensed recording, run it through Gemini for a
diarized timestamped transcript, generate the summary and action items, write JSON into
`content/seed/`. Hand-correct the output where it is wrong — it is committed data, so fixing it by
hand is legitimate and cheap.

The seed set must include **one long multi-speaker call** (target: ~8 speakers, ~1 hour). The brief
calls this out specifically as "the case that actually matters", and it is where naive builds fall
over: speaker attribution, transcript virtualization, and summaries that stay useful at length.

## Build order

Value lives in the call detail page, so that is milestone one — not the shell, not the nav.
See `specs/` for the contract of each. If the clock bites, cut from the bottom.

0. Foundation — Next.js, design system, data model, seed pipeline
1. Call detail — player + synced transcript + summary + action items
2. Ask — real LLM, citations that seek the player, single-call and cross-call
3. Library — home, meetings list, search across calls
4. Capture — desktop surface, live overlays, integration settings
5. Share — public link to a call or a clip
6. Deploy + walkthrough

## Conventions

- **Discuss tradeoffs before implementing**, build part by part, commit per step.
- Commit `.agent-logs/` interleaved with the code it produced. Never edit or tidy a log entry.
- Every spec checklist update carries a short plain-language note on what happened and why.
- Design decisions get made on a canvas first where they are non-obvious (the `design` skill),
  following the `~/projects/orin` precedent.
