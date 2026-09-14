#!/usr/bin/env python3
"""
8x assignment capture hook.

Wired to two Claude Code lifecycle events in .claude/settings.json:
  UserPromptSubmit -> writes a [LOG_ENTRY type=PROMPT] entry
  Stop             -> writes a [LOG_ENTRY type=RESPONSE] entry

Prompt and final response only. No thinking, no tool calls, no intermediate
steps. One markdown file per session in .agent-logs/.
"""
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
LOGS = REPO / ".agent-logs"
STATE = Path.home() / ".claude" / ".capture-state"
AUTHOR = "ashutoshsao"
TOOL = "claude-code"


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + \
        f"{datetime.now(timezone.utc).microsecond // 1000:03d}Z"


def project_name():
    try:
        return json.loads((REPO / "package.json").read_text())["name"]
    except Exception:
        return REPO.name


def read_transcript(path):
    rows = []
    if not path:
        return rows
    try:
        with open(path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    rows.append(json.loads(line))
                except Exception:
                    pass
    except Exception:
        pass
    return rows


def model_from_transcript(rows):
    for row in reversed(rows):
        msg = row.get("message") or {}
        model = msg.get("model")
        if model:
            return model
    return None


def model_with_retry(path, attempts=1):
    """The transcript lags the turn: the final assistant line (which carries the
    model name) is often flushed a beat after the Stop hook fires. Poll briefly."""
    for i in range(attempts):
        model = model_from_transcript(read_transcript(path))
        if model:
            return model
        if i + 1 < attempts:
            time.sleep(0.1)
    return None


def model_cache():
    STATE.mkdir(parents=True, exist_ok=True)
    return STATE / f"last-model_{project_name()}.txt"


def remember_model(model):
    if model and model != "unknown":
        try:
            model_cache().write_text(model)
        except Exception:
            pass


def recall_model():
    try:
        return model_cache().read_text().strip() or None
    except Exception:
        return None


def last_assistant_text(rows):
    for row in reversed(rows):
        if row.get("type") != "assistant":
            continue
        content = (row.get("message") or {}).get("content")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts = [b.get("text", "") for b in content
                     if isinstance(b, dict) and b.get("type") == "text"]
            text = "\n".join(p for p in parts if p.strip())
            if text.strip():
                return text
    return ""


def state_path(session_id):
    STATE.mkdir(parents=True, exist_ok=True)
    return STATE / f"{session_id}.json"


def load_state(session_id):
    try:
        return json.loads(state_path(session_id).read_text())
    except Exception:
        return {}


def save_state(session_id, state):
    state_path(session_id).write_text(json.dumps(state))


def log_file(session_id, state):
    """One file per session. Name is fixed at the session's first prompt."""
    existing = sorted(LOGS.glob(f"*_{session_id}.md"))
    if existing:
        return existing[0]
    name = state.get("file")
    if name:
        return LOGS / name
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
    return LOGS / f"{stamp}_{session_id}.md"


def render_frontmatter(state):
    return (
        "---\n"
        f"session_id: {state['session_id']}\n"
        f"date: {state['date']}\n"
        f"author: {AUTHOR}\n"
        f"model: {state.get('model') or 'unknown'}\n"
        f"tool: {TOOL}\n"
        f"project: {state['project']}\n"
        f"total_exchanges: {state.get('count', 0)}\n"
        f"first_prompt_time: {state.get('first_prompt_time', '')}\n"
        f"last_prompt_time: {state.get('last_prompt_time', '')}\n"
        "---\n"
    )


def write_entry(session_id, state, kind, num, model, body):
    LOGS.mkdir(parents=True, exist_ok=True)
    path = log_file(session_id, state)
    state["file"] = path.name
    short = session_id[:8]

    if path.exists():
        text = path.read_text(encoding="utf-8")
        rest = re.sub(r"\A---\n.*?\n---\n", "", text, count=1, flags=re.S)
    else:
        rest = (
            f"\n# Session Log - {state['date']}\n\n"
            f"Session: `{short}` | Project: `{state['project']}` | Author: `{AUTHOR}`\n\n"
            "---\n"
        )

    entry = (
        f"\n[LOG_ENTRY type={kind} num={num} session={short}]\n"
        f"timestamp: {now()}\n"
        f"model: {model}\n\n"
        f"{body.rstrip()}\n\n"
    )
    path.write_text(render_frontmatter(state) + rest + entry, encoding="utf-8")


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return

    event = payload.get("hook_event_name", "")
    session_id = payload.get("session_id") or "unknown-session"
    rows = read_transcript(payload.get("transcript_path"))

    state = load_state(session_id)
    state.setdefault("session_id", session_id)
    state.setdefault("project", project_name())
    state.setdefault("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    state.setdefault("count", 0)

    if event == "Stop":
        # wait up to ~2s for the final assistant line to land
        model = model_with_retry(payload.get("transcript_path"), attempts=20)
    else:
        model = model_from_transcript(rows)
    model = model or state.get("model") or recall_model() or "unknown"
    remember_model(model)

    if event == "UserPromptSubmit":
        prompt = payload.get("user_prompt")
        if prompt is None:
            prompt = payload.get("prompt", "")
        if not str(prompt).strip():
            return
        state["count"] += 1
        state["model"] = model
        ts = now()
        state.setdefault("first_prompt_time", ts)
        state["last_prompt_time"] = ts
        state["awaiting"] = state["count"]
        write_entry(session_id, state, "PROMPT", state["count"], model, str(prompt))
        save_state(session_id, state)

    elif event == "Stop":
        num = state.get("awaiting")
        if not num:
            return  # nothing pending: don't invent a response entry
        text = payload.get("last_assistant_message") or last_assistant_text(rows)
        if not str(text).strip():
            text = "(empty final response)"
        state["model"] = model
        state["awaiting"] = None
        write_entry(session_id, state, "RESPONSE", num, model, str(text))
        save_state(session_id, state)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass  # never block a turn on capture failure
    sys.exit(0)
