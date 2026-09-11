import { beforeEach, describe, expect, it } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { Effect } from "effect";
import {
  hydrateSettings,
  saveNotifications,
  saveNotifyEvent,
} from "@/lib/studio/settings";

const STORE_RID = 7;

function store(entries: readonly [string, unknown][]) {
  const written = new Map<string, unknown>();
  mockIPC((cmd, payload) => {
    if (cmd === "plugin:store|load") {
      return STORE_RID;
    }
    if (cmd === "plugin:store|entries") {
      return entries;
    }
    if (cmd === "plugin:store|set") {
      const { key, value } = payload as { key: string; value: unknown };
      written.set(key, value);
      return null;
    }
    if (cmd === "plugin:store|save") {
      return null;
    }
    throw new Error(`unexpected command: ${cmd}`);
  });
  return written;
}

describe("hydrateSettings", () => {
  beforeEach(() => {
    store([]);
  });

  it("reads a file without the notifications key as unanswered", async () => {
    const settings = await Effect.runPromise(hydrateSettings);

    expect(settings.notifications).toBeNull();
  });

  it("reads the notifications switch back", async () => {
    store([["notifications", "enabled"]]);

    expect((await Effect.runPromise(hydrateSettings)).notifications).toBe(true);

    store([["notifications", "disabled"]]);

    expect((await Effect.runPromise(hydrateSettings)).notifications).toBe(
      false
    );
  });

  it("reads a missing event key as unanswered and a stored one back", async () => {
    store([["notifyExport", "disabled"]]);

    const { notifyEvents } = await Effect.runPromise(hydrateSettings);

    expect(notifyEvents).toEqual({
      export: false,
      sidecar: null,
      turnEnded: null,
      waiting: null,
    });
  });

  it("writes an event switch under its own key", async () => {
    const written = store([]);
    await Effect.runPromise(hydrateSettings);

    await Effect.runPromise(saveNotifyEvent("waiting", false));

    expect(written.get("notifyWaiting")).toBe("disabled");
  });

  it("writes the switch as a word", async () => {
    const written = store([]);
    await Effect.runPromise(hydrateSettings);

    await Effect.runPromise(saveNotifications(true));

    expect(written.get("notifications")).toBe("enabled");
  });
});
