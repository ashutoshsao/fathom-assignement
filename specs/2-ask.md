# 2 — Ask

## Goal

The feature that makes Fathom feel like more than a transcript viewer: ask a question in natural
language, get an answer grounded in what was actually said, with citations that take you to the
moment. Second milestone because it is the product's differentiator and the easiest thing to fake
badly — a canned answer is obvious within one question.

## Contract

- A real streamed LLM answer over the real transcript. No canned responses.
- Answers carry **source chips with timestamps** (`@ 0:42`), and clicking one **seeks the player**.
- Citations are **grounded** — a chip points at a moment that genuinely supports the claim.
- Works **scoped to one call** and **across all calls** (the scope selector in the real product).
- Suggested prompts on an empty state, matching the real product's behaviour.
- Handles the hour-long transcript without falling over on context.

## Decisions

- **Streamed from a Next.js route handler** via `generateContentStream`, so the key stays on the
  server and the answer appears progressively rather than after a long silence.
- **Citations come from structured output, not regex over prose.** Ask the model for
  `{ answer, citations: [{ atSec, label }] }` against a `responseSchema`. Parsing timestamps back
  out of free text is the fragile version of this and it will drift.
- **No vector RAG. Full transcripts in context.** Measured: the largest call is 23,672 tokens and
  the entire five-call library is **71,424 tokens — 6.8% of one 1M context window**. Retrieval here
  would be infrastructure for a problem we do not have, and it would actively degrade answers:
  the questions that matter are global ("what might fall through the cracks?", "what was mentioned
  as urgent"), which top-k chunk similarity answers badly and *silently* — a plausible answer with
  a citation that does not support it, which is the worst possible failure for a product whose
  credibility rests on "click the chip and hear it yourself". Full context also gives the model
  exact segment IDs to cite, which is what makes citation-seek precise.
- **The seam is kept, the implementation is not.** Cross-call Ask still has a "select candidate
  calls" step, so retrieval can slot in later without reshaping the feature. At demo scale that step
  is cheap metadata-and-summary filtering, not embeddings. The threshold where this genuinely flips
  is ~85 hours of meetings (~12k tokens per hour of speech), which a real account would cross and
  this one does not.

## Progress

- [ ] `/api/ask` route handler, streaming, structured `{ answer, citations }`
- [ ] Ask panel UI: streaming answer, suggested prompts, scope selector
- [ ] Citation chips that seek the player
- [ ] Cross-call scope with retrieval
- [ ] Grounding spot-checked against the long call — citations land where they claim
