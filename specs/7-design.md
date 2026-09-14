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

- [x] **Type ramp + motion tokens** in `globals.css`, plus a shared `.label` for the uppercase
      section headings that appear in the summary, the rail and the library.
- [x] **Call header**: title leads at 23px, metadata recedes to 12.5px with dot separators and the
      platform named, participants and Share grouped away from the title.
- [x] **Summary pane**: labels, a lead paragraph that reads first, body at 14px/1.62, and one
      consistent pressable timestamp chip everywhere it appears.
- [x] **Compact player, wider Ask rail** (400px) so Ask owns the space rather than competing.
- [x] **Library cards** with per-call tinted art, participant names, platform and time; page
      header with a real title and a total.
- [x] **Transcript** at a 640px measure and 1.72 line-height for long sessions.
- [x] **Motion** on tab change, answer arrival and citation arrival — 140ms, state changes only.
- [x] **Full suite green**: 35 unit, 25 integration, verified at the 110-minute call.

## Two bugs the design pass surfaced

Both had been shipped and invisible:

- **The player's scrubber never rendered.** 420 bars drawn with a 1px gap need 420px of gap alone,
  but the call rail is 368px wide — every bar was squeezed to sub-pixel width and the scrubber
  painted as empty space. It now downsamples to what the width can show, taking the loudest peak
  per bucket so the shape survives rather than flattening to the mean.
- **Card art did not distinguish anything.** Tinting by the first speaker was reasonable until the
  data arrived: every call's first speaker is id 0, so all five cards came out identically blue.
  The tint is now derived from the call id.

And one correction that needed checking rather than assuming: the pipeline heard "Dave Norris";
an intermediate fix wrote "Dave Morris", which disagreed with the two calls the pipeline had got
right. HPR's own show notes settle it as **Dave Morriss**. Logged in
`content/seed/CORRECTIONS.md`.
