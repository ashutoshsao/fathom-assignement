# 6 — Deploy and walkthrough

## Goal

Turn a working local build into the three things actually handed in: a live link, a public repo,
and a five-minute video.

## Contract

- Live on Vercel, opening correctly **in a private window with no session**.
- `GEMINI_API_KEY` set in Vercel; Ask works in production, not only locally.
- Repo public, `.agent-logs/` committed throughout, `CAPTURE-TEST.md` at the root.
- README explaining what was built, what was stubbed, and what was deliberately left out.
- Walkthrough under five minutes, camera on, that says plainly which parts are simulated.

## Decisions

- **Deploy early, not at the end.** A first deploy happens in M0 so that deployment failures surface
  while there is still time to fix them, rather than in the last hour.

## Progress

- [ ] First deploy green (during M0)
- [ ] Production env vars set, Ask verified in prod
- [ ] Logged-out check in a private window
- [ ] README written
- [ ] Walkthrough recorded
