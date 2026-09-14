# 7 — Design pass

## Goal

Make the thing good to use, not merely correct. UX/UI is one of the three things the brief scores,
and it is the weakest part of what exists: the app was built to sensible tokens and never
iterated on.

**Direction A chosen** from the two put on a canvas (`design/fathom-ui/`). A keeps the existing
near-black palette and blue accent and fixes what is actually weak; B was an editorial take with
a serif and a warmer accent. A was picked as the stronger fit — closer to the real product, and a
restyle of working code rather than a rebuild.

## The problem, measured

Counting the type sizes actually used in the components:

    36 × 13px      18 × 11px      12 × 12px      10 × 14px
     3 × 15px       2 × 19px       1 × 18px       1 × 16px

Almost the entire application is one size. There is no ramp, so nothing leads and nothing recedes
— every screen reads as a settings page regardless of what is on it.

## Contract

- A real type ramp, applied consistently: display / lead / body / UI / label.
- The call header has hierarchy — title leads, metadata recedes, actions sit apart.
- The player is compact so the Ask panel gets the room it needs.
- Library cards differentiate: the card art carries the speaker palette, and each row shows who
  was on the call, the platform and whether it produced action items.
- Timestamp chips read as a consistent, pressable component everywhere they appear.
- Motion on the state changes that currently snap: tab switch, answer streaming, citation arrival.
- Blue is reserved for actions and active state, not decoration.
- Nothing regresses: full suite green, and the layout still holds at the long call.

## Decisions

- **No new colours.** The palette was already right; the problem was hierarchy and rhythm, not
  hue. Adding colour would have hidden the actual fault.
- **Type ramp as CSS tokens**, not per-component values, so the ramp is enforceable rather than
  a convention that decays on the next component.
- **Motion is short and few.** 120-180ms, on state changes only. Animation as decoration is the
  fastest way to make a tool feel slow.

## Progress

- [ ] Type ramp + spacing tokens in `globals.css`
- [ ] Call header: hierarchy, metadata row, platform, actions grouped
- [ ] Summary pane: section labels, lead paragraph, body measure, timestamp chip component
- [ ] Compact player, wider Ask rail
- [ ] Library cards: palette-carrying art, participants, platform, action count
- [ ] Transcript: reading measure and line-height for long sessions
- [ ] Motion on tab change, streaming answer, citation arrival
- [ ] Full suite green, verified at the 110-minute call
