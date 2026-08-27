// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { SqlDriver, SqlRow, SqlValue } from "@/sidecar/history/driver";
import { migrate, prepare } from "@/sidecar/history/migrations";
import { make as makeProjects } from "@/sidecar/history/projects";
import { make as makeSessions } from "@/sidecar/history/store";
import { make } from "@/sidecar/history/videos";

function nodeDriver(): SqlDriver {
  const db = new DatabaseSync(":memory:");

  return {
    all: (sql, params = []) =>
      db.prepare(sql).all(...(params as SqlValue[])) as SqlRow[],
    close: () => db.close(),
    exec: (sql) => db.exec(sql),
    run: (sql, params = []) =>
      Number(db.prepare(sql).run(...(params as SqlValue[])).changes),
  };
}

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);

// The ordering reads millisecond timestamps, so two rows written in the same
// tick tie; a couple of milliseconds is what makes the assertion about the
// rule rather than about insertion order.
const tick = () => new Promise((resolve) => setTimeout(resolve, 2));

function opened() {
  const driver = nodeDriver();
  prepare(driver);
  migrate(driver);

  return {
    projects: makeProjects(driver),
    sessions: makeSessions(driver),
    videos: make(driver),
  };
}

async function project(store: ReturnType<typeof opened>, path = "/p/promo") {
  const row = await run(store.projects.open(path));
  return row.id;
}

function draft(projectId: string, compositionId: string, name = compositionId) {
  return { compositionId, name, projectId };
}

describe("VideoStore", () => {
  it("creates a video and finds it again", async () => {
    const store = opened();
    const projectId = await project(store);

    const video = await run(
      store.videos.create(draft(projectId, "intro", "Интро"))
    );

    expect(video.compositionId).toBe("intro");
    expect(video.name).toBe("Интро");
    expect(video.missing).toBe(false);
    expect(video.deletedAt).toBeNull();
    expect(await run(store.videos.find(video.id))).toEqual(video);
  });

  it("orders videos by their most recent chat, then by creation", async () => {
    const store = opened();
    const projectId = await project(store);

    const first = await run(store.videos.create(draft(projectId, "one")));
    await tick();
    const second = await run(store.videos.create(draft(projectId, "two")));
    await tick();

    expect((await run(store.videos.list(projectId))).map((v) => v.id)).toEqual([
      second.id,
      first.id,
    ]);

    await run(
      store.sessions.open({
        id: "s1",
        mode: "auto",
        projectId,
        provider: "claude",
        title: "a chat",
        videoId: first.id,
      })
    );

    expect((await run(store.videos.list(projectId))).map((v) => v.id)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it("leaves a deleted video out of the list and puts it back on restore", async () => {
    const store = opened();
    const projectId = await project(store);
    const video = await run(store.videos.create(draft(projectId, "intro")));

    expect(await run(store.videos.remove(video.id))).toBe(true);
    expect(await run(store.videos.list(projectId))).toEqual([]);
    expect(await run(store.videos.remove(video.id))).toBe(false);

    const back = await run(store.videos.restore(video.id));

    expect(back.deletedAt).toBeNull();
    expect(await run(store.videos.list(projectId))).toEqual([back]);
  });

  it("takes the composition a chat is under with the chat", async () => {
    const store = opened();
    const projectId = await project(store);
    const video = await run(store.videos.create(draft(projectId, "intro")));

    await run(
      store.sessions.open({
        id: "s1",
        mode: "auto",
        projectId,
        provider: "claude",
        title: "a chat",
        videoId: video.id,
      })
    );

    const session = (await run(store.sessions.sessions)).at(0);

    expect(session?.videoId).toBe(video.id);
  });
});

describe("reconcile", () => {
  it("adopts a composition the bundle names and nothing knew about", async () => {
    const store = opened();
    const projectId = await project(store);

    const videos = await run(
      store.videos.reconcile(projectId, ["intro", "outro"])
    );

    expect(videos.map((video) => video.compositionId).sort()).toEqual([
      "intro",
      "outro",
    ]);
    expect(videos.every((video) => video.name === video.compositionId)).toBe(
      true
    );
  });

  it("marks a row the bundle no longer names as missing, and keeps it", async () => {
    const store = opened();
    const projectId = await project(store);
    await run(store.videos.create(draft(projectId, "intro")));

    const [video] = await run(store.videos.reconcile(projectId, []));

    expect(video?.compositionId).toBe("intro");
    expect(video?.missing).toBe(true);
  });

  it("never resurrects a video the person deleted", async () => {
    const store = opened();
    const projectId = await project(store);
    const video = await run(store.videos.create(draft(projectId, "intro")));
    await run(store.videos.remove(video.id));

    expect(await run(store.videos.reconcile(projectId, ["intro"]))).toEqual([]);
    expect((await run(store.videos.find(video.id))).deletedAt).not.toBeNull();
  });

  it("leaves another project's videos alone", async () => {
    const store = opened();
    const mine = await project(store, "/p/mine");
    const other = await project(store, "/p/other");
    await run(store.videos.create(draft(other, "intro")));

    await run(store.videos.reconcile(mine, []));

    const [video] = await run(store.videos.list(other));

    expect(video?.missing).toBe(false);
  });
});

describe("taken", () => {
  it("counts a deleted video's slug as taken", async () => {
    const store = opened();
    const projectId = await project(store);
    const video = await run(store.videos.create(draft(projectId, "intro")));
    await run(store.videos.remove(video.id));

    expect(await run(store.videos.taken(projectId))).toEqual(["intro"]);
  });
});
