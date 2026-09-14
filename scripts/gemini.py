#!/usr/bin/env python3
"""
Shared Gemini client with model rotation.

The free tier's real limit is 20 requests per day PER MODEL
(`GenerateRequestsPerDayPerProjectPerModel-FreeTier`) — not the per-minute token ceiling that the
docs lead you to expect, and far tighter than published third-party figures suggest.

But it is scoped per model, and the key has many interchangeable flash-class models. So the budget
is 20 x (number of models), and the job is to spend it deliberately:

  - rotate: each call goes to the next model in the pool, spreading load evenly
  - fail over: a 429 retires that model for this run and the request is retried on the next one,
    rather than sleeping and burning the quota again
  - never waste: every completed unit of work is cached to disk, so a run that dies partway is
    resumed rather than repeated. Retries count against quota, so a retry loop is expensive.
"""
import json
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
API = "https://generativelanguage.googleapis.com"

# Flash-class models, all 1M context and all capable of audio. Ordered by preference.
MODEL_POOL = [
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-3.8-flash",
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash-lite",
]

_lock = threading.Lock()
_next = 0
_exhausted = set()
_counts = {}


def api_key():
    for line in (REPO / "apps" / "web" / ".env").read_text().splitlines():
        if line.startswith("GEMINI_API_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("GEMINI_API_KEY not found in apps/web/.env")


def _take_model():
    global _next
    with _lock:
        live = [m for m in MODEL_POOL if m not in _exhausted]
        if not live:
            return None
        m = live[_next % len(live)]
        _next += 1
        _counts[m] = _counts.get(m, 0) + 1
        return m


def _retire(model, why):
    with _lock:
        if model not in _exhausted:
            _exhausted.add(model)
            print(f"      [{model} exhausted: {why}; "
                  f"{len(MODEL_POOL) - len(_exhausted)} models left]", flush=True)


def usage_report():
    with _lock:
        return ", ".join(f"{m}={n}" for m, n in sorted(_counts.items()))


def generate(key, parts, schema, thinking=4096, temperature=0.0, timeout=1800):
    """Send one request, rotating models and failing over on quota exhaustion."""
    body = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": schema,
            "temperature": temperature,
            "thinkingConfig": {"thinkingBudget": thinking},
        },
    }
    data = json.dumps(body).encode()

    transient = 0
    while True:
        model = _take_model()
        if model is None:
            sys.exit("every model in the pool is out of quota — resume tomorrow, or add a model")
        url = f"{API}/v1beta/models/{model}:generateContent?key={key}"
        try:
            req = urllib.request.Request(url, data=data,
                                         headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                d = json.load(r)
            text = d["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text), d.get("usageMetadata", {}), model
        except urllib.error.HTTPError as e:
            detail = e.read().decode()
            if e.code == 429:
                _retire(model, "429 daily quota")
                continue
            if e.code == 404:
                _retire(model, "not available for this request")
                continue
            if e.code in (500, 503) and transient < 3:
                transient += 1
                time.sleep(10 * transient)
                continue
            sys.exit(f"HTTP {e.code} on {model}: {detail[:300]}")
        except Exception as e:
            if transient < 3:
                transient += 1
                time.sleep(5)
                continue
            sys.exit(f"{type(e).__name__} on {model}: {e}")


def upload(key, path, label):
    """Files API resumable upload. Uploads do not count against the generate quota."""
    data = path.read_bytes()
    req = urllib.request.Request(
        f"{API}/upload/v1beta/files?key={key}",
        data=json.dumps({"file": {"display_name": label}}).encode(),
        headers={"X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start",
                 "X-Goog-Upload-Header-Content-Length": str(len(data)),
                 "X-Goog-Upload-Header-Content-Type": "audio/mp3",
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        url = r.headers["X-Goog-Upload-URL"]
    req = urllib.request.Request(url, data=data,
                                 headers={"Content-Length": str(len(data)),
                                          "X-Goog-Upload-Offset": "0",
                                          "X-Goog-Upload-Command": "upload, finalize"})
    with urllib.request.urlopen(req) as r:
        info = json.load(r)["file"]
    while info.get("state") == "PROCESSING":
        time.sleep(2)
        with urllib.request.urlopen(f"{API}/v1beta/{info['name']}?key={key}") as r:
            info = json.load(r)
    if info.get("state") != "ACTIVE":
        sys.exit(f"upload failed: {info.get('state')}")
    return info["uri"]
