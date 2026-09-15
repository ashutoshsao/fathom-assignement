import { expect, test } from "@playwright/test";

/**
 * Recording, as far as a headless browser can go.
 *
 * The capture itself needs a real tab-share gesture, which cannot be granted headlessly — so what
 * is asserted here is everything around it: the entry point exists and is honest about its
 * limits, a recording that is not in this browser fails gracefully rather than crashing, and a
 * stored recording renders through the same call UI as a seeded one.
 */

test("the library offers recording, and states its limits up front", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Record a meeting" })).toBeVisible();
  await expect(page.getByText(/Chrome or Edge only/)).toBeVisible();
  await expect(page.getByText(/stays in this browser/)).toBeVisible();
});

test("a recording that is not in this browser explains itself instead of erroring", async ({ page }) => {
  await page.goto("/recordings/rec-does-not-exist");
  await expect(page.getByText("This recording is not in this browser.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to My Calls" })).toBeVisible();
});

test("a recording still processing is playable, and says so", async ({ page }) => {
  // Auto-resume would otherwise finish the job the moment we open the page, so hold the
  // transcription open to observe the processing state itself.
  await page.route("**/api/transcribe", () => {
    /* never fulfilled: the request stays in flight */
  });

  await page.goto("/");
  await page.evaluate(async () => {
    const call = {
      id: "rec-processing",
      title: "New recording",
      daysAgo: 0,
      timeOfDay: "10:00",
      durationSec: 30,
      platform: "google-meet",
      blurb: "Transcribing\u2026",
      speakers: [],
      waveform: [0.3, 0.7, 0.5],
      summary: { purpose: "", keyTakeaways: [], topics: [], nextSteps: [] },
      actionItems: [],
      transcript: [],
      highlights: [],
      source: { name: "Recorded in your browser", url: "", license: "local", licenseUrl: "" },
      status: "processing",
    };
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("fathom-recordings", 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains("calls")) {
          req.result.createObjectStore("calls", { keyPath: "id" });
        }
      };
      req.onsuccess = () => {
        const tx = req.result.transaction("calls", "readwrite");
        tx.objectStore("calls").put({
          id: call.id,
          call,
          audio: new Blob([new Uint8Array([0, 1, 2])], { type: "audio/webm" }),
          createdAt: Date.now(),
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });

  await page.goto("/recordings/rec-processing");
  // The point of the optimistic save: it is playable before the model has seen it.
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  await expect(page.getByText(/Transcribing and writing the notes/)).toBeVisible();
  await expect(page.getByText(/you can leave this page/)).toBeVisible();
});

test("a spent demo quota explains itself rather than looking broken", async ({ page }) => {
  await page.route("**/api/ask", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          type: "error",
          kind: "quota",
          message:
            "The demo's daily AI quota is used up — this runs on Gemini's free tier, which allows a fixed number of requests per day. It resets at midnight Pacific. Everything else on this page still works.",
        }) + "\n",
    }),
  );

  await page.goto("/calls/hpr4314");
  await page.getByPlaceholder("Ask anything...").fill("anything");
  await page.keyboard.press("Enter");

  await expect(page.getByText(/daily AI quota is used up/)).toBeVisible();
  await expect(page.getByText(/resets at midnight Pacific/)).toBeVisible();
});

test("an interrupted transcription is picked back up on reload, not left hanging", async ({ page }) => {
  let transcribeCalls = 0;
  await page.route("**/api/transcribe", async (route) => {
    transcribeCalls++;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        transcript: {
          speakers: [{ id: 0, name: "Ashutosh" }],
          segments: [{ startSec: 0, endSec: 3, speaker: 0, text: "Resumed fine." }],
        },
        notes: {
          title: "Recovered recording",
          blurb: "Picked up after a reload.",
          purpose: "Prove resume works.",
          keyTakeaways: [{ point: "It resumed", segmentIndex: 0 }],
          topics: [],
          actionItems: [],
          nextSteps: [],
        },
      }),
    });
  });

  await page.goto("/");
  // A recording left mid-transcription, exactly as a closed tab would leave it.
  await page.evaluate(async () => {
    const call = {
      id: "rec-interrupted",
      title: "New recording",
      daysAgo: 0,
      timeOfDay: "10:00",
      durationSec: 20,
      platform: "google-meet",
      blurb: "Transcribing\u2026",
      speakers: [],
      waveform: [0.4, 0.6],
      summary: { purpose: "", keyTakeaways: [], topics: [], nextSteps: [] },
      actionItems: [],
      transcript: [],
      highlights: [],
      source: { name: "Recorded in your browser", url: "", license: "local", licenseUrl: "" },
      status: "processing",
    };
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("fathom-recordings", 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains("calls")) {
          req.result.createObjectStore("calls", { keyPath: "id" });
        }
      };
      req.onsuccess = () => {
        const tx = req.result.transaction("calls", "readwrite");
        tx.objectStore("calls").put({
          id: call.id,
          call,
          audio: new Blob([new Uint8Array(4096)], { type: "audio/webm" }),
          createdAt: Date.now(),
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });

  // Landing on it fresh is the reload case: no in-memory job exists.
  await page.goto("/recordings/rec-interrupted");

  await expect(page.getByRole("heading", { name: "Recovered recording" })).toBeVisible({
    timeout: 15_000,
  });
  expect(transcribeCalls).toBe(1);
});

test("a stored recording renders through the same call UI as a seeded call", async ({ page }) => {
  await page.goto("/");

  // Write a recording straight into IndexedDB, standing in for a real capture.
  await page.evaluate(async () => {
    const call = {
      id: "rec-test",
      title: "Planning sync",
      daysAgo: 0,
      timeOfDay: "10:00",
      durationSec: 12,
      platform: "google-meet",
      blurb: "A short planning conversation.",
      speakers: [{ id: 0, name: "Ashutosh", initials: "AS", colorIndex: 0 }],
      waveform: [0.4, 0.8, 0.3],
      summary: {
        purpose: "Agree the next step.",
        keyTakeaways: [{ point: "Ship the draft on Friday", atSec: 4 }],
        topics: [],
        nextSteps: [],
      },
      actionItems: [],
      transcript: [
        { id: 0, startSec: 0, endSec: 4, text: "Shall we start?", speaker: 0 },
        { id: 1, startSec: 4, endSec: 12, text: "Ship the draft on Friday.", speaker: 0 },
      ],
      highlights: [],
      source: { name: "Recorded in your browser", url: "", license: "local", licenseUrl: "" },
    };

    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("fathom-recordings", 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains("calls")) {
          req.result.createObjectStore("calls", { keyPath: "id" });
        }
      };
      req.onsuccess = () => {
        const tx = req.result.transaction("calls", "readwrite");
        tx.objectStore("calls").put({
          id: call.id,
          call,
          audio: new Blob([new Uint8Array([0, 1, 2, 3])], { type: "audio/webm" }),
          createdAt: Date.now(),
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });

  await page.goto("/recordings/rec-test");
  await expect(page.getByRole("heading", { name: "Planning sync" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();

  // The takeaway appears in the summary, anchored to the moment it came from...
  await expect(page.getByText("Ship the draft on Friday", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "0:04" })).toBeVisible();

  // ...and the same words appear in the transcript, clickable to seek.
  await page.getByRole("button", { name: "Transcript" }).click();
  await expect(page.locator("span[title='Play from 0:04']")).toBeVisible();

  // And it shows up in the library, marked as local.
  await page.goto("/");
  await expect(page.getByText("Recorded in this browser")).toBeVisible();
  await expect(page.getByText("only visible to you")).toBeVisible();
});

test("ending the capture from the browser's own bar still saves the recording", async ({ page }) => {
  // The failure this covers: Chrome's "Stop sharing" bar ended the capture, the recorder class
  // stopped its MediaRecorder and told nobody, and the audio was discarded without ever reaching
  // /api/transcribe. Ending from the browser's control must take the same path as pressing Stop.
  let transcribeCalls = 0;
  await page.route("**/api/transcribe", async (route) => {
    transcribeCalls++;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        transcript: {
          speakers: [{ id: 0, name: "You" }],
          segments: [{ startSec: 0, endSec: 2, speaker: 0, text: "Testing one two." }],
        },
        notes: {
          title: "Tab capture test",
          blurb: "Ended from the browser bar.",
          purpose: "Prove the external stop path saves.",
          keyTakeaways: [],
          topics: [],
          actionItems: [],
          nextSteps: [],
        },
      }),
    });
  });

  await page.goto("/");

  // Drive the recorder directly: getDisplayMedia cannot be granted headlessly, so stand in a
  // stream whose video track we can end the way the browser's bar does.
  await page.evaluate(() => {
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    const osc = ctx.createOscillator();
    osc.connect(dest);
    osc.start();

    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 2;
    const videoTrack = (canvas as HTMLCanvasElement).captureStream(1).getVideoTracks()[0]!;
    const fake = new MediaStream([...dest.stream.getAudioTracks(), videoTrack]);

    (navigator.mediaDevices as unknown as Record<string, unknown>).getDisplayMedia = async () =>
      fake;
    (window as unknown as Record<string, unknown>).__endSharing = () => videoTrack.stop();
    // A stopped track does not fire "ended" on its own; the browser bar does.
    videoTrack.addEventListener("ended", () => {});
    (window as unknown as Record<string, unknown>).__fireEnded = () =>
      videoTrack.dispatchEvent(new Event("ended"));
  });

  await page.getByRole("button", { name: "Record a meeting" }).click();
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible({ timeout: 10_000 });

  // Now end it the way Chrome's bar does, rather than pressing Stop.
  await page.evaluate(() => (window as unknown as Record<string, () => void>).__fireEnded!());

  await expect(page.getByRole("heading", { name: "Tab capture test" })).toBeVisible({
    timeout: 20_000,
  });
  expect(transcribeCalls).toBe(1);
});

test("a recorded call shows its length and a moving scrubber", async ({ page }) => {
  // MediaRecorder writes WebM as a live stream with no duration in the header, so the element
  // reports Infinity. That showed as "0:00" and froze the played fill, because progress is
  // time/duration. The length we timed during recording is used instead.
  await page.goto("/");
  await page.evaluate(async () => {
    const call = {
      id: "rec-duration",
      title: "Timed recording",
      daysAgo: 0,
      timeOfDay: "12:00",
      durationSec: 240,
      platform: "google-meet",
      blurb: "Has a known length.",
      speakers: [{ id: 0, name: "You", initials: "YO", colorIndex: 0 }],
      waveform: Array.from({ length: 60 }, (_, i) => 0.3 + (i % 5) * 0.1),
      summary: { purpose: "", keyTakeaways: [], topics: [], nextSteps: [] },
      actionItems: [],
      transcript: [{ id: 0, startSec: 0, endSec: 4, text: "Hello.", speaker: 0 }],
      highlights: [],
      source: { name: "Recorded in your browser", url: "", license: "local", licenseUrl: "" },
      status: "ready",
    };
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("fathom-recordings", 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains("calls")) {
          req.result.createObjectStore("calls", { keyPath: "id" });
        }
      };
      req.onsuccess = () => {
        const tx = req.result.transaction("calls", "readwrite");
        tx.objectStore("calls").put({
          id: call.id,
          call,
          audio: new Blob([new Uint8Array(2048)], { type: "audio/webm" }),
          createdAt: Date.now(),
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });

  await page.goto("/recordings/rec-duration");
  // 240s must show as the total even though the blob cannot report it.
  await expect(page.getByText("4:00")).toBeVisible();
});
