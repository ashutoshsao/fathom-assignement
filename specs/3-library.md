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

- [ ] `?t=` deep link: the call page opens at a given second
- [ ] Cross-call citation chips navigate to that deep link
- [ ] Ask on the library page, scoped to all calls
- [ ] Search API over transcripts, returning call + moment + surrounding text
- [ ] Search UI: input in the top bar, results that seek on click
- [ ] Unbuilt nav sections honestly marked
- [ ] Tests: deep link, cross-call ask, search result → correct call and second
- [ ] Full suite green (unit + integration)
