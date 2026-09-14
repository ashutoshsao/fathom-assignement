# Future considerations — what we deliberately left out

The brief judges *what you left out* as much as what you built. These are conscious cuts, not
oversights. Each says why it did not earn its place in 24 hours.

## Not built

- **A real recording bot.** Explicitly permitted by the brief to stub. Building meeting-platform
  capture would consume the entire window and produce nothing a reviewer can see.
- **Auth and multi-user accounts.** The live link must open for a stranger; auth adds risk to the
  one check that can fail the whole submission, and nobody is scoring the login form.
- **A database.** Nothing in the 24-hour scope needs durable writes. Seed JSON in the repo is
  faster, deploys atomically, and cannot be in a broken state at review time.
- **Zoom and Teams integrations.** Google Meet is built through; the others appear honestly in
  settings. Breadth in integrations is cosmetic.
- **Team Calls, Playlists, Alerts, Deals, CRM sync, AI Scorecards.** Real Fathom surfaces, but they
  are the enterprise sales layer, not the core loop. Present in nav, honestly marked.
- **Email/Slack delivery of summaries.** Outbound plumbing with no visible product surface.
- **Mobile layouts below `md`.** The product is a desktop tool and the reviewer is on a laptop.

## Parked ideas worth noting

- Editing the transcript to correct speaker attribution, then regenerating the summary.
- Templates for the summary (the real product switches between meeting types).
- Comments on a shared call.
- Ask over a playlist rather than one call or all calls.
