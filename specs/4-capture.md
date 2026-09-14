# 4 — Capture

## Goal

The half of Fathom a web-only clone throws away: the desktop app and the overlays that decide
whether a call gets recorded at all. This is the mechanic that makes the product distinctive, and
it is what the walkthrough video will actually show — a reviewer watching a meeting get captured
understands the product in ten seconds in a way no amount of browsing a library achieves.

Built as working simulations driven by a real clock. The brief explicitly permits stubbing the
capture layer; the rule this repo holds to is that **the stub is visible, and everything
downstream of it is real**.

## Contract

- A **`/desktop` surface** with its own window chrome and a "My Meetings" layout, visibly a
  different application from the web app rather than the same page reskinned.
- A **pre-call overlay** fired by a real scheduler over seeded calendar events: *"Impromptu Google
  Meet Meeting starts in 1 min — record?"*, with Record / Don't record, and the choice changing
  real state.
- A **live recording overlay**: elapsed timer, stop, and a highlight button that marks the moment.
- A **post-call transition** — recording ends, and the call appears in the library.
- A **settings page** for video-conferencing integrations, with Google Meet built through and the
  others in honest "Partially enabled" states, plus auto-record / auto-share preferences.
- **Demonstrable on demand.** A real clock that only fires at the seeded time is useless on
  camera, so the whole sequence can be triggered immediately.
- Nothing regresses: full suite still green.

## Decisions

- **Google Meet is the only integration built through.** Zoom and Teams appear with honest
  states. Breadth in integrations is cosmetic; depth on one is the product.
- **The simulated capture produces a real call record**, using one of the seeded calls as the
  "newly recorded" result. The alternative — a fake row that opens nothing — would undercut the
  one claim this repo makes about stubs.
- **Say it in the UI, not just the README.** Where capture is simulated, the interface says so.
  A reviewer should never have to wonder whether we are claiming to have built a recording bot.
- **No Electron.** The deliverable is a live link; a desktop binary cannot be one. The desktop
  surface is a route styled as an app window, which is honest as long as it is labelled.

## Progress

- [ ] Seeded calendar events with a real scheduler (upcoming meeting, countdown)
- [ ] `/desktop` surface: window chrome, My Meetings list
- [ ] Pre-call overlay: countdown, Record / Don't record, state change
- [ ] Live recording overlay: elapsed timer, stop, mark highlight
- [ ] Post-call: recording ends → call appears in the library
- [ ] Settings: video-conferencing integrations + auto-record / auto-share
- [ ] Demo trigger so the sequence can be shown in seconds on camera
- [ ] Simulation labelled honestly in the UI
- [ ] Tests: overlay fires, record choice changes state, stop produces a call
- [ ] Full suite green
