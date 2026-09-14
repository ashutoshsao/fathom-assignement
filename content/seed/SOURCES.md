# Audio sources and attribution

All seed audio in this repo is real, human, multi-speaker conversation from
[Hacker Public Radio](https://hackerpublicradio.org), used under **CC BY-SA 4.0**.

## Why this source

HPR's *Community News* is not a podcast imitating a meeting — it **is** a meeting. A rotating team
of volunteers meets over Mumble in the last week of each month to go through the month's shows and
community business. That gives us exactly what a meeting notetaker demo needs and what synthetic
audio cannot fake: people interrupting each other, talking over each other, trailing off,
mishearing, and referring back to things decided in earlier months.

It also means the seed library is a **recurring meeting series with the same team across months**,
which is far more realistic than four unrelated calls — and it makes cross-call Ask genuinely
useful ("what did we say about this last month?") instead of a party trick.

## Episodes used

| File | Episode | Recorded | Length |
|---|---|---|---|
| `hpr4066.mp3` | hpr4066 :: HPR Community News for February 2024 | 2024-02 | ~70 min |
| `hpr4086.mp3` | hpr4086 :: HPR Community News for March 2024 | 2024-03 | ~61 min |
| `hpr4111.mp3` | hpr4111 :: HPR Community News for April 2024 | 2024-04 | ~72 min |
| `hpr4176.mp3` | hpr4176 :: HPR Community News for July 2024 | 2024-07 | ~50 min |

Hosted by HPR Volunteers — the recurring voices across these episodes include Ken Fallon,
Dave Morris, Kevie, and Some Guy On The Internet (SGOTI).

Originals: `https://archive.org/details/<episode-id>` · Show notes:
`https://hackerpublicradio.org/eps/<episode-id>/index.html`

## Changes made to the original works

Required disclosure under CC BY-SA:

1. **Transcoded** from stereo MP3 to **mono, 32 kbps, 22.05 kHz** to keep the repo and the deploy a
   sane size. No edits to content, no trimming, no reordering.
2. **Speaker labels added.** HPR publishes a Whisper transcript with timestamped segments but no
   speaker attribution. Diarization was added by us (see `scripts/`) and is our own annotation, not
   part of the original work.
3. Titles are presented in the app as the episodes' own titles.

## Licensing

- **The audio files and the transcripts derived from them** (`apps/web/public/audio/*.mp3`,
  `content/seed/*`) are licensed **CC BY-SA 4.0**, the same licence as the originals, and must stay
  that way if redistributed. <https://creativecommons.org/licenses/by-sa/4.0/>
- **The application code in this repo is not a derivative of the audio** and is not bound by
  ShareAlike. Software that plays a CC BY-SA recording does not become CC BY-SA.

## Transcripts

Timestamped transcripts come from the Whisper JSON that HPR publishes alongside each episode
(`{text, segments, language}`), so speech-to-text cost us nothing and is as accurate as the
original publisher's own pass. Raw originals live in `content/source-audio/` and are gitignored —
they are re-downloadable from the URLs above.
