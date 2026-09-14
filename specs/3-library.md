# 3 — Library

## Goal

Everything around the call page: finding a call among many, and asking questions across all of
them rather than one at a time. Third, not first — a beautiful list of calls you cannot open is
worth nothing, so the call page was built before the shell that leads to it.

This milestone also absorbs the one thing M2 left unfinished: **cross-call Ask**. The `/api/ask`
route already answers over every transcript when given no `callId`; what is missing is the place
in the UI where that makes sense, which is here.

## Contract

When this is done, all of the following are true:

- The library lists calls grouped by day, with real card art, duration, blurb and participants.
- **Search finds words spoken inside calls**, not just titles, and takes you to the moment.
- **Ask works across the whole library**, with citations that navigate to the right call *and*
  land on the right second once there.
- Sections we chose not to build are visibly marked as such, not presented as working links.
- Nothing regresses: the full test suite still passes.

## Decisions

- **Search is server-side over the seed index, not a client-side filter.** The transcripts total
  ~55k words; shipping them to the browser to filter would mean downloading every call to search.
- **Search matches transcript text and reports the moment**, because "which call was that in"
  is the actual question people have, and a title match cannot answer it.
- **A cross-call citation navigates, then seeks.** The audio for another call lives on another
  page, so the chip carries the position in the URL (`/calls/<id>?t=1500`) and the call page
  honours it on load. Same promise as within a call: press the claim, hear the moment.

## Progress

- [x] **`?t=` deep link.** The call page opens at a given second, waiting for audio metadata
      before seeking (seeking an unloaded element is a silent no-op). Out-of-range values are
      clamped to the call duration rather than trusted.
- [x] **Cross-call citation chips navigate to that deep link.** Required decoupling `AskPanel`
      from the player: on the library page there is no player at all, so `usePlaybackOptional`
      lets the same component work in both places instead of duplicating it.
- [x] **Ask on the library page, scoped to all calls.** Collapsed behind a button by default —
      the library's job is to get you into a call, and a permanently open chat panel competes
      with that.
- [x] **Search API over transcripts**, returning call, moment, speaker and surrounding text.
      Neighbouring segments are included because Whisper lines are often three words long and a
      bare match reads as a fragment.
- [x] **Search UI** in the top bar, debounced, results linking straight to the moment.
- [x] **Unbuilt nav sections honestly marked** (Team Calls, Playlists, Alerts) — shown, not
      clickable, titled with why.
- [x] **Tests**: deep link, out-of-range deep link, search → correct call and second, honest
      empty state, and the full cross-call path (chip → navigate → land on the right second).
- [x] **Full suite green**: 27 unit, 14 integration.

## What this milestone actually taught

- **Title search would have been useless here by construction.** The five calls are the same
  recurring meeting with near-identical titles, so "which call was that in" can only be answered
  by searching what was *said*. Seeding a realistic library exposed that; four unrelated calls
  would have hidden it.
- **A deep link is not just a query param.** Seeking before `loadedmetadata` silently does
  nothing, which would have shipped as "cross-call citations sometimes don't work".
