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
- **Cross-call Ask retrieves before it answers.** Sending every transcript in full does not survive
  a real library; select candidate calls first, then answer over those.

## Progress

- [ ] `/api/ask` route handler, streaming, structured `{ answer, citations }`
- [ ] Ask panel UI: streaming answer, suggested prompts, scope selector
- [ ] Citation chips that seek the player
- [ ] Cross-call scope with retrieval
- [ ] Grounding spot-checked against the long call — citations land where they claim
