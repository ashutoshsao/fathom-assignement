# Hand corrections to generated seed data

`SOURCES.md` records that speaker labels are our own annotation rather than part of the original
work. Where the pipeline mis-heard something, correcting it by hand is legitimate — the data is
committed, not generated at request time. Each correction is listed here so the seed stays
auditable.

| Wrong | Right | Why |
|---|---|---|
| `Dave Norris` | `Dave Morriss` | The diarization pass mis-heard the surname. HPR's own published show notes spell it **Morriss**, with two s — verified against `hackerpublicradio.org/eps/hpr4111/`. |

Note on the second s: an intermediate pass of this correction wrote "Dave Morris" (one s), which
disagreed with the two calls where the pipeline had heard it correctly. The mismatch between the
two spellings in the library is what surfaced the error; the published show notes settled it.
