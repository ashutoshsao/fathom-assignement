# 4 — Capture

## Goal

The half of Fathom that a web-only clone throws away: the desktop app and the overlays that decide
whether a call gets recorded at all. Built as working simulations driven by a real clock, because
this is the mechanic that makes the product distinctive — and it is what the walkthrough video will
actually show.

## Contract

- A **`/desktop` surface** with its own window chrome and the "My Meetings" layout.
- A **pre-call overlay** that fires on a real timer against seeded calendar events: *"Impromptu
  Google Meet Meeting starts in 1 min — record?"* with Record / Don't record, and the choice
  changes real state.
- A **live recording overlay**: elapsed timer, stop, and a highlight button that marks the moment.
- A **post-call transition** — recording ends, the call appears in the library with its summary.
- A **settings page** for video-conferencing integrations (Google Meet first, per the real
  product's "Partially Enabled" states) and the auto-record / auto-share preferences.
- The overlays must be demonstrable **on demand** during a five-minute walkthrough — a real clock
  that only fires at the seeded time is useless on camera, so there is a way to trigger the
  sequence immediately.

## Decisions

- **Google Meet is the only integration built through.** Zoom and Teams appear in settings with
  honest states. Breadth here is cosmetic; depth on one is the product.
- **The stub is visible, not hidden.** Where capture is simulated, the UI says so rather than
  implying a recording bot exists. The brief rewards saying what you stubbed.

## Progress

- [ ] `/desktop` surface with window chrome + My Meetings
- [ ] Scheduler over seeded calendar events
- [ ] Pre-call join/record overlay, real state change
- [ ] Live recording overlay with timer, stop, highlight
- [ ] Post-call → call appears in library
- [ ] Integrations + auto-record settings
- [ ] Demo trigger so the whole sequence can be shown on camera in seconds
