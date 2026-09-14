# CAPTURE-TEST.md

Proof that automatic prompt/response capture is installed and working before any
assignment code was written.

---

## 1. Tool and model

| | |
|---|---|
| **Tool** | Claude Code CLI v2.1.270 (`claude`), macOS / zsh |
| **Model** | Opus 5 with the 1M-context window — exact ID `claude-opus-5[1m]` |
| **Planning vs. execution** | Same model does both. No planner/executor split, no model routing. Sub-agents, if used later, inherit the same model unless a log entry shows otherwise. |
| **What the transcript records** | The session transcript writes the model as `claude-opus-5`, without the `[1m]` context suffix, so that is the string that appears in the logs. |

**Does the tool have an automatic hook mechanism?** Yes. Claude Code has a hooks system
configured in `.claude/settings.json`. Confirmed against the current docs at
<https://code.claude.com/docs/en/hooks> rather than from memory. The two events that
matter here:

- `UserPromptSubmit` — fires on every prompt submission. stdin JSON carries
  `session_id`, `prompt_id`, `transcript_path`, `cwd`, `permission_mode`, and
  `user_prompt` (the verbatim prompt text).
- `Stop` — fires when Claude finishes responding, i.e. once per turn. stdin JSON
  carries `session_id`, `transcript_path`, `effort`, and `last_assistant_message`
  (the complete final response text for that turn).

Both fire on their own, on every turn, in every session in this project directory.
Nothing has to be remembered or run by hand.

---

## 2. Mechanism and files changed

| File | Role |
|---|---|
| `.claude/settings.json` | **The config I changed.** Wires `UserPromptSubmit` and `Stop` to the capture script. Project-scoped, committed, so it applies to every session opened in this repo. |
| `.claude/hooks/capture.py` | The capture script. Reads the hook payload on stdin, appends one log entry, exits 0. |
| `.agent-logs/` | Output. One markdown file per session, `YYYY-MM-DD_HH-MM-SS_<session-id>.md`. Committed, **not** gitignored. |

Hook wiring:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command",
                     "command": "python3 \"$CLAUDE_PROJECT_DIR/.claude/hooks/capture.py\"",
                     "timeout": 20 } ] }
    ],
    "Stop": [
      { "hooks": [ { "type": "command",
                     "command": "python3 \"$CLAUDE_PROJECT_DIR/.claude/hooks/capture.py\"",
                     "timeout": 20 } ] }
    ]
  }
}
```

Design notes:

- **Prompt and final response only.** The prompt comes from `user_prompt`, verbatim and
  untruncated. The response comes from `last_assistant_message`, which is the final
  assistant text for the turn — no thinking blocks, no tool calls, no intermediate
  steps, no retries. The transcript is only ever read for the model name, never for
  response content (except as a fallback if `last_assistant_message` is absent).
- **Never blocks a turn.** The script swallows its own exceptions and always exits 0,
  and prints nothing to stdout (`UserPromptSubmit` stdout would be injected into the
  model's context).
- **Per-session counters** live outside the repo, in
  `~/.claude/.capture-state/<session-id>.json`, so no scratch state is committed.
  Only `total_exchanges`, `last_prompt_time` and the frontmatter `model` are rewritten
  as a session grows. Log entries themselves are append-only and are never edited.
- **A `Stop` with no pending prompt is ignored**, so a resumed or continued session
  cannot produce an orphan RESPONSE entry with no PROMPT.

---

## 3. Where the canaries landed

Two canaries, two separate sessions, launched as independent headless `claude -p`
processes so the second one proves the hook is installed at the project level and not
just live in the session that created it.

- Canary 1: `.agent-logs/2026-09-14_09-22-21_722c95e0-fa94-4cca-b846-ba4eadc7ad31.md`
- Canary 2: `.agent-logs/2026-09-14_09-22-27_7c963f5a-9754-47fc-81f4-db05766c86fa.md`

---

## 4. Both canary entries, raw

### Canary 1 — session `722c95e0`

```
---
session_id: 722c95e0-fa94-4cca-b846-ba4eadc7ad31
date: 2026-09-14
author: ashutoshsao
model: claude-opus-5
tool: claude-code
project: fathom-assignmnt
total_exchanges: 1
first_prompt_time: 2026-09-14T09:22:21.605Z
last_prompt_time: 2026-09-14T09:22:21.605Z
---

# Session Log - 2026-09-14

Session: `722c95e0` | Project: `fathom-assignmnt` | Author: `ashutoshsao`

---

[LOG_ENTRY type=PROMPT num=1 session=722c95e0]
timestamp: 2026-09-14T09:22:21.605Z
model: unknown

CAPTURE TEST — 8x assignment, Ashutosh Sao. Reply with one short sentence confirming the canary landed. Do not use any tools.


[LOG_ENTRY type=RESPONSE num=1 session=722c95e0]
timestamp: 2026-09-14T09:22:23.906Z
model: claude-opus-5

Canary received — 8x assignment, Ashutosh Sao, confirmed.
```

### Canary 2 — session `7c963f5a`

```
---
session_id: 7c963f5a-9754-47fc-81f4-db05766c86fa
date: 2026-09-14
author: ashutoshsao
model: claude-opus-5
tool: claude-code
project: fathom-assignmnt
total_exchanges: 1
first_prompt_time: 2026-09-14T09:22:27.191Z
last_prompt_time: 2026-09-14T09:22:27.191Z
---

# Session Log - 2026-09-14

Session: `7c963f5a` | Project: `fathom-assignmnt` | Author: `ashutoshsao`

---

[LOG_ENTRY type=PROMPT num=1 session=7c963f5a]
timestamp: 2026-09-14T09:22:27.191Z
model: claude-opus-5

CAPTURE TEST 2 — 8x assignment, Ashutosh Sao. Separate second session. Reply with one short sentence. Do not use any tools.


[LOG_ENTRY type=RESPONSE num=1 session=7c963f5a]
timestamp: 2026-09-14T09:22:29.341Z
model: claude-opus-5

Capture test 2 acknowledged — separate session, no tools used.
```

---

## 5. What I tried first that did not work

### a. A dry-run harness that silently swallowed two of four calls

First offline test piped four fake hook payloads into the script with `echo` in zsh.
The log came out with only the last exchange in it, numbered `1`, which looked like a
state-persistence bug that would lose entries mid-build.

It was the test harness, not the script. zsh's builtin `echo` interprets `\n`, so the
`\n` I had embedded inside a JSON string value became a literal newline, making that
payload invalid JSON. The script parsed nothing and returned — and the following `Stop`
correctly declined to write an orphan RESPONSE. Re-run with clean payloads, the
four-call sequence appended all four entries in order. I kept the "no pending prompt →
write nothing" guard, since that test accidentally proved it works.

### b. `model:` logged as `unknown` on the first two canaries

The first canary pair landed correctly but recorded `model: unknown` everywhere. The
hook payload does not include the model name, so the script was reading it from the
session transcript — and the docs' warning that `transcript_path` "may lag the current
turn" is real: at `Stop` time the final assistant line, which is what carries
`message.model`, had not been flushed yet. The hook read the file 43ms in and found no
assistant entry at all.

Fix: at `Stop`, poll the transcript for up to ~2s for the model name, and cache the last
model seen per project so a new session's first prompt can fall back to it.

Those first two canaries are still in `.agent-logs/`, left as they were:

- `.agent-logs/2026-09-14_09-17-51_2ea72097-1d9f-409f-937f-2105adb0ee85.md`
- `.agent-logs/2026-09-14_09-18-02_d4b9ecb5-c1e1-4be1-ad4a-59a558e0f01f.md`

### c. Known residual limitation, stated rather than papered over

In canary 1 the PROMPT entry still reads `model: unknown` while its RESPONSE reads
`claude-opus-5`. That is the fallback chain being honest: I had deliberately cleared the
model cache immediately before that run, so at the instant of the very first prompt of a
brand-new session there was genuinely no model name available anywhere yet. Canary 2,
run seconds later, picked it up from the cache and got it right on the prompt too.

Every RESPONSE entry carries the real model, so a mid-build model switch is always
visible in the log. I preferred leaving a visible `unknown` over backfilling the entry
after the fact.

### d. Capture was installed mid-session, so this session's first prompt is not in the log

I installed the hooks during the session that set them up, and Claude Code loads hooks
at session start. The prompt that kicked all this off — the assignment brief itself —
therefore has no PROMPT entry. From the mid-session message onward this session logs
normally, which is visible in
`.agent-logs/2026-09-14_09-21-26_3f87bc43-e12d-430a-9df0-b63f4ee79095.md`, and every
session opened from here on is captured from its first prompt.
