import { afterEach, describe, expect, it } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Effect } from "effect";
import { previewKeyOf, prunePreviewOutputs } from "./outputs";

const made: string[] = [];

afterEach(() => {
  for (const created of made.splice(0)) {
    rmSync(created, { force: true, recursive: true });
  }
});

function root(): string {
  const created = mkdtempSync(path.join(tmpdir(), "remocn-outputs-"));
  made.push(created);
  return created;
}

const NOW = Date.parse("2026-09-26T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

describe("prunePreviewOutputs", () => {
  it("removes the bundles of projects the studio no longer knows, and only those", async () => {
    const base = root();
    const known = previewKeyOf("/Users/me/kept");
    const gone = previewKeyOf("/Users/me/deleted");

    for (const name of [
      known,
      `${known}-native`,
      gone,
      `${gone}-native`,
      "jobs",
      "stills",
      "notes",
    ]) {
      mkdirSync(path.join(base, name));
    }

    const removed = await Effect.runPromise(
      prunePreviewOutputs({ known: ["/Users/me/kept"], now: NOW, root: base })
    );

    expect([...removed].sort()).toEqual([gone, `${gone}-native`].sort());
    expect(existsSync(path.join(base, known))).toBe(true);
    expect(existsSync(path.join(base, `${known}-native`))).toBe(true);
    expect(existsSync(path.join(base, gone))).toBe(false);
    expect(existsSync(path.join(base, "jobs"))).toBe(true);
    expect(existsSync(path.join(base, "notes"))).toBe(true);
  });

  it("drops stills older than a day and keeps today's", async () => {
    const base = root();
    const stills = path.join(base, "stills");
    mkdirSync(path.join(stills, "readiness-old"), { recursive: true });
    writeFileSync(path.join(stills, "fresh.png"), "");
    const old = new Date(NOW - 2 * DAY);
    utimesSync(path.join(stills, "readiness-old"), old, old);
    utimesSync(
      path.join(stills, "fresh.png"),
      new Date(NOW - 60_000),
      new Date(NOW - 60_000)
    );

    const removed = await Effect.runPromise(
      prunePreviewOutputs({ known: [], now: NOW, root: base })
    );

    expect(removed).toEqual([path.join("stills", "readiness-old")]);
    expect(existsSync(path.join(stills, "fresh.png"))).toBe(true);
  });

  it("answers nothing when there is no preview folder yet", async () => {
    const removed = await Effect.runPromise(
      prunePreviewOutputs({
        known: [],
        now: NOW,
        root: path.join(root(), "missing"),
      })
    );

    expect(removed).toEqual([]);
  });
});
