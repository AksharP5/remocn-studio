import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Exit } from "effect";
import type { SqlDriver } from "@/sidecar/history/driver";
import { MIGRATIONS, migrate, prepare } from "@/sidecar/history/migrations";
import { make, type ProjectStore } from "@/sidecar/history/projects";
import { driverFor } from "@/sidecar/history/sqlite";
import { make as makeHistory } from "@/sidecar/history/store";
import { make as makeVideos } from "@/sidecar/history/videos";

function nodeDriver(): SqlDriver {
  return driverFor(":memory:");
}

function store(): ProjectStore {
  const driver = nodeDriver();
  prepare(driver);
  migrate(driver);
  return make(driver);
}

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);

const temporary = () => mkdtemp(join(tmpdir(), "remocn-project-"));

describe("ProjectStore", () => {
  it("names a project after its folder and finds it again", async () => {
    const projects = store();

    const opened = await run(projects.open("/videos/promo"));

    expect(opened.name).toBe("promo");
    expect(opened.path).toBe("/videos/promo");
    expect(await run(projects.find(opened.id))).toEqual(opened);
    expect(await run(projects.list)).toEqual([opened]);
  });

  it("lands on the same row when the folder is opened again", async () => {
    const projects = store();

    const first = await run(projects.open("/videos/promo"));
    const again = await run(projects.open("/videos/../videos/promo/"));

    expect(again.id).toBe(first.id);
    expect(await run(projects.list)).toHaveLength(1);
  });

  it("resolves a symlink to the folder it points at", async () => {
    const projects = store();
    const real = await temporary();
    const link = join(await temporary(), "link");
    await symlink(real, link);

    const direct = await run(projects.open(real));
    const followed = await run(projects.open(link));

    expect(followed.id).toBe(direct.id);
    expect(await run(projects.list)).toHaveLength(1);
  });

  it("keeps the row of a folder that is gone and says it is missing", async () => {
    const projects = store();
    const folder = await temporary();

    const opened = await run(projects.open(folder));
    expect(opened.missing).toBe(false);

    await rm(folder, { recursive: true });

    const [listed] = await run(projects.list);
    expect(listed.id).toBe(opened.id);
    expect(listed.missing).toBe(true);
  });

  it("renames a project without touching its path", async () => {
    const projects = store();
    const opened = await run(projects.open("/videos/promo"));

    const renamed = await run(projects.rename(opened.id, "Launch film"));

    expect(renamed.name).toBe("Launch film");
    expect(renamed.path).toBe(opened.path);
  });

  it("fails rather than inventing a project that was never opened", async () => {
    const projects = store();

    const exit = await Effect.runPromiseExit(projects.find("nope"));

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("orders projects by their most recent session", async () => {
    const driver = nodeDriver();
    prepare(driver);
    migrate(driver);
    const projects = make(driver);
    const history = makeHistory(driver);

    const first = await run(projects.open("/videos/first"));
    const second = await run(projects.open("/videos/second"));
    const video = await run(
      makeVideos(driver).create({
        compositionId: "promo",
        name: "Promo",
        projectId: first.id,
      })
    );
    await run(
      history.open({
        id: "s-1",
        mode: "auto",
        projectId: first.id,
        provider: "claude" as const,
        title: "A promo",
        videoId: video.id,
      })
    );

    expect((await run(projects.list)).map((row) => row.id)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it("takes the sessions and their blocks with it when removed", async () => {
    const driver = nodeDriver();
    prepare(driver);
    migrate(driver);
    const projects = make(driver);
    const history = makeHistory(driver);

    const project = await run(projects.open("/videos/promo"));
    const video = await run(
      makeVideos(driver).create({
        compositionId: "promo",
        name: "Promo",
        projectId: project.id,
      })
    );
    const session = await run(
      history.open({
        id: "s-1",
        mode: "auto",
        projectId: project.id,
        provider: "claude" as const,
        title: "A promo",
        videoId: video.id,
      })
    );
    await run(
      history.write({
        entry: { id: "a-1", kind: "assistant", text: "hi" },
        ordinal: 0,
        sessionId: session.id,
      })
    );

    expect(await run(projects.remove(project.id))).toBe(true);
    expect(await run(projects.remove(project.id))).toBe(false);
    expect(await run(history.sessions)).toEqual([]);
    expect(driver.all("SELECT session_id FROM block")).toEqual([]);
  });
});

const byText = (one: string, other: string) => one.localeCompare(other);

describe("the migration to projects", () => {
  function version1(): SqlDriver {
    const driver = nodeDriver();
    prepare(driver);

    for (const statement of MIGRATIONS[0]) {
      if (typeof statement === "string") {
        driver.exec(statement);
      }
    }
    driver.exec("PRAGMA user_version = 1");

    return driver;
  }

  function session(driver: SqlDriver, id: string, folder: string, at: number) {
    driver.run(
      `INSERT INTO session (id, sdk_session_id, folder, title, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, `sdk-${id}`, folder, `Session ${id}`, at, at]
    );
    driver.run(
      `INSERT INTO block (session_id, ordinal, kind, payload, created_at)
       VALUES (?, 0, 'assistant', ?, ?)`,
      [id, JSON.stringify({ text: `block of ${id}` }), at]
    );
  }

  // Migration 6 clears the chats, so these two read the state migration 2
  // leaves rather than the end of the chain — otherwise they would be
  // measuring the clear, not the regrouping.
  function upTo(driver: SqlDriver, version: number) {
    driver.exec("PRAGMA foreign_keys = OFF");
    for (const step of MIGRATIONS.slice(1, version).flat()) {
      if (typeof step === "string") {
        driver.exec(step);
      } else {
        step(driver);
      }
    }
    driver.exec(`PRAGMA user_version = ${version}`);
    driver.exec("PRAGMA foreign_keys = ON");
  }

  it("puts every old session under a project named after its folder", () => {
    const driver = version1();
    session(driver, "one", "/videos/promo", 10);
    session(driver, "two", "/videos/promo", 20);
    session(driver, "three", "/videos/teaser", 30);

    upTo(driver, 2);

    const projects = driver.all(
      "SELECT id, path, name, created_at, updated_at FROM project"
    );
    expect(projects.map((row) => String(row.name)).sort(byText)).toEqual([
      "promo",
      "teaser",
    ]);

    const promo = projects.find((row) => row.path === "/videos/promo");
    expect(promo?.created_at).toBe(10);
    expect(promo?.updated_at).toBe(20);

    const sessions = driver.all(
      "SELECT id, project_id, sdk_session_id FROM session"
    );
    expect(sessions).toHaveLength(3);
    expect(
      sessions
        .filter((row) => row.project_id === promo?.id)
        .map((row) => String(row.id))
        .sort(byText)
    ).toEqual(["one", "two"]);
    expect(sessions.find((row) => row.id === "one")?.sdk_session_id).toBe(
      "sdk-one"
    );
  });

  it("leaves the transcripts alone while it rebuilds the table", () => {
    const driver = version1();
    session(driver, "one", "/videos/promo", 10);

    upTo(driver, 2);

    expect(driver.all("SELECT COUNT(*) AS rows FROM block").at(0)).toEqual({
      rows: 1,
    });
  });

  it("keeps the projects when the chats are cleared for videos", async () => {
    const driver = version1();
    session(driver, "one", "/videos/promo", 10);

    migrate(driver);

    expect(await run(make(driver).list)).toHaveLength(1);
    expect(await run(makeHistory(driver).sessions)).toEqual([]);
  });
});
