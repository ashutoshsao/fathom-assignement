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

- ~~**Deploy early, not at the end.**~~ **Overridden.** The call was made to deploy once the output
  is worth showing rather than on a schedule. The risk this accepts is that a deployment problem
  surfaces late; it is mitigated by the stack being deliberately boring (Next.js on Vercel, no
  database, no auth, static seed data), so there is very little that can fail at deploy time that
  would not also fail locally. The one genuinely deploy-only risk is `GEMINI_API_KEY` in Vercel's
  environment, which is a single setting to check.

## Progress

- [ ] First deploy green (during M0)
- [ ] Production env vars set, Ask verified in prod
- [ ] Logged-out check in a private window
- [ ] README written
- [ ] Walkthrough recorded
