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

- [ ] Public share route, verified in a logged-out browser
- [ ] Share a call
- [ ] Share a clip around a moment
- [ ] Copy-link affordance from the call page
