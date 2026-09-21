import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Clock, Context, Effect, Schema } from "effect";
import { errorMessage } from "@/lib/error-message";
import { Project } from "@/shared/ipc";
import { canonicalPath, nameOf } from "../canonical";
import {
  configEffect,
  getConfig,
  readManifest,
  saveConfig,
} from "../projects/config";
import type { SqlDriver, SqlRow } from "./driver";
import { HistoryError } from "./store";

export interface ProjectStore {
  readonly find: (id: string) => Effect.Effect<Project, HistoryError>;
  readonly list: Effect.Effect<readonly Project[], HistoryError>;
  readonly open: (path: string) => Effect.Effect<Project, HistoryError>;
  readonly relocate: (
    id: string,
    path: string
  ) => Effect.Effect<Project, HistoryError>;
  readonly remove: (id: string) => Effect.Effect<boolean, HistoryError>;
  readonly rename: (
    id: string,
    name: string
  ) => Effect.Effect<Project, HistoryError>;
}

export const ProjectStore = Context.Service<ProjectStore>(
  "sidecar/ProjectStore"
);

export function openStudioProject(projects: ProjectStore, path: string) {
  return Effect.gen(function* () {
    const canonical = canonicalPath(path);
    const registered = yield* projects.list;
    const known = registered.some((project) => project.path === canonical);
    const manifest = yield* configEffect(() => readManifest(canonical)).pipe(
      Effect.mapError(failed)
    );
    if (!known && manifest === null) {
      return yield* Effect.fail(
        new HistoryError({
          message:
            "Open a project created by Remocn Studio, or create a new project in Studio. External Remotion folders are not supported.",
        })
      );
    }
    return yield* projects.open(canonical);
  });
}

const COLUMNS = "id, path, name, created_at, updated_at" as const;

const BY_LAST_SESSION = `SELECT ${COLUMNS} FROM project
   ORDER BY COALESCE(
     (SELECT MAX(updated_at) FROM session WHERE project_id = project.id),
     updated_at
   ) DESC` as const;

const decodeProject = Schema.decodeUnknownEffect(Project);

const failed = (cause: unknown) =>
  new HistoryError({ message: errorMessage(cause) });

function attempt<A>(thunk: () => A): Effect.Effect<A, HistoryError> {
  return Effect.try({ catch: failed, try: thunk });
}

export function make(driver: SqlDriver): ProjectStore {
  const reconcile = (project: Project) =>
    Effect.gen(function* () {
      if (project.missing) {
        return project;
      }
      const manifest = yield* configEffect(() =>
        readManifest(project.path)
      ).pipe(Effect.mapError(failed));
      if (manifest === null) {
        return project;
      }
      if (manifest.projectId !== project.id) {
        return yield* Effect.fail(
          new HistoryError({
            message:
              "The registered folder contains a different project identity.",
          })
        );
      }
      yield* attempt(() =>
        driver.run(
          "UPDATE project SET name = ?, config_revision = ? WHERE id = ?",
          [manifest.name, manifest.revision, project.id]
        )
      );
      return { ...project, name: manifest.name };
    });
  const read = (id: string) =>
    attempt(() =>
      driver.all(`SELECT ${COLUMNS} FROM project WHERE id = ?`, [id])
    ).pipe(
      Effect.flatMap((rows) => only(rows, `there is no project ${id}`)),
      Effect.flatMap(reconcile)
    );

  return {
    find: read,

    list: attempt(() => driver.all(BY_LAST_SESSION)).pipe(
      Effect.flatMap((rows) =>
        Effect.forEach(rows, (row) =>
          projectOf(row).pipe(Effect.flatMap(reconcile))
        )
      )
    ),

    open: (path) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const canonical = canonicalPath(path);
        const manifest = yield* configEffect(() =>
          readManifest(canonical)
        ).pipe(Effect.mapError(failed));
        if (manifest !== null) {
          const collisions = yield* attempt(() =>
            driver.all("SELECT path FROM project WHERE id = ? AND path <> ?", [
              manifest.projectId,
              canonical,
            ])
          );
          if (collisions.length > 0) {
            return yield* Effect.fail(
              new HistoryError({
                message:
                  "This project identity is already registered at another location. Use Locate folder for the moved original; copies must have a distinct identity.",
              })
            );
          }
        }

        yield* attempt(() =>
          driver.run(
            `INSERT INTO project (${COLUMNS}) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT (path) DO NOTHING`,
            [
              manifest?.projectId ?? crypto.randomUUID(),
              canonical,
              manifest?.name ?? nameOf(canonical),
              now,
              now,
            ]
          )
        );

        const rows = yield* attempt(() =>
          driver.all(`SELECT ${COLUMNS} FROM project WHERE path = ?`, [
            canonical,
          ])
        );

        const project = yield* only(rows, `${canonical} could not be opened`);
        if (manifest !== null) {
          if (manifest.projectId !== project.id) {
            return yield* Effect.fail(
              new HistoryError({
                message:
                  "The manifest identity does not match the registered project.",
              })
            );
          }
          yield* attempt(() =>
            driver.run(
              "UPDATE project SET name = ?, config_revision = ? WHERE id = ?",
              [manifest.name, manifest.revision, project.id]
            )
          );
          return { ...project, name: manifest.name };
        }
        return project;
      }),

    relocate: (id, path) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const canonical = canonicalPath(path);
        const current = yield* read(id);
        const target = yield* configEffect(() => readManifest(canonical)).pipe(
          Effect.mapError(failed)
        );
        if (target === null) {
          const entries = yield* attempt(() =>
            driver.all(
              "SELECT composition_id FROM video WHERE project_id = ? AND deleted_at IS NULL",
              [id]
            )
          );
          const valid = yield* configEffect(async () => {
            const pkg = JSON.parse(
              await readFile(join(canonical, "package.json"), "utf8")
            );
            return (
              Boolean(
                pkg.dependencies?.remotion || pkg.devDependencies?.remotion
              ) &&
              entries.every((entry) =>
                existsSync(
                  join(canonical, "src", "videos", String(entry.composition_id))
                )
              )
            );
          }).pipe(Effect.mapError(failed));
          if (!valid) {
            return yield* Effect.fail(
              new HistoryError({
                message:
                  "The selected folder does not match this legacy Remotion project.",
              })
            );
          }
          yield* configEffect(() =>
            saveConfig(
              { ...current, path: canonical },
              {
                brand: null,
                expectedRevision: 0,
                name: current.name,
                projectId: id,
              }
            )
          ).pipe(Effect.mapError(failed));
        } else if (target.projectId !== id) {
          return yield* Effect.fail(
            new HistoryError({
              message: "The selected folder belongs to a different project.",
            })
          );
        }

        const taken = yield* attempt(() =>
          driver.all("SELECT name FROM project WHERE path = ? AND id <> ?", [
            canonical,
            id,
          ])
        );

        const other = taken.at(0);
        if (other !== undefined) {
          return yield* Effect.fail(
            new HistoryError({
              message: `${canonical} is already open as ${String(other.name)}`,
            })
          );
        }

        yield* attempt(() =>
          driver.run(
            "UPDATE project SET path = ?, updated_at = ? WHERE id = ?",
            [canonical, now, id]
          )
        );

        yield* attempt(() =>
          driver.run(
            "UPDATE session SET sdk_session_id = NULL WHERE project_id = ?",
            [id]
          )
        );
        return yield* read(id);
      }),

    remove: (id) =>
      attempt(() => driver.run("DELETE FROM project WHERE id = ?", [id])).pipe(
        Effect.map((changes) => changes > 0)
      ),

    rename: (id, name) =>
      Effect.gen(function* () {
        const project = yield* read(id);
        const config = yield* configEffect(() => getConfig(project)).pipe(
          Effect.mapError(failed)
        );
        if (!name.trim()) {
          return yield* Effect.fail(
            new HistoryError({ message: "Enter a project name." })
          );
        }
        const saved = project.missing
          ? { name: name.trim() }
          : yield* configEffect(() =>
              saveConfig(project, {
                brand: config.brand,
                expectedRevision: config.revision,
                name,
                projectId: id,
              })
            ).pipe(Effect.mapError(failed));
        const now = yield* Clock.currentTimeMillis;

        yield* attempt(() =>
          driver.run(
            "UPDATE project SET name = ?, updated_at = ? WHERE id = ?",
            [saved.name, now, id]
          )
        );

        return yield* read(id);
      }),
  };
}

export function broken(message: string): ProjectStore {
  const fail = Effect.fail(new HistoryError({ message }));

  return {
    find: () => fail,
    list: fail,
    open: () => fail,
    relocate: () => fail,
    remove: () => fail,
    rename: () => fail,
  };
}

function only(
  rows: readonly SqlRow[],
  absent: string
): Effect.Effect<Project, HistoryError> {
  const row = rows.at(0);
  return row === undefined
    ? Effect.fail(new HistoryError({ message: absent }))
    : projectOf(row);
}

function projectOf(row: SqlRow): Effect.Effect<Project, HistoryError> {
  const path = String(row.path);

  return decodeProject({
    createdAt: row.created_at,
    id: row.id,
    missing: !existsSync(path),
    name: row.name,
    path,
    updatedAt: row.updated_at,
  }).pipe(Effect.mapError(failed));
}
