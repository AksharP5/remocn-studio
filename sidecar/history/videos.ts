import { Clock, Context, Effect, Schema } from "effect";
import { errorMessage } from "@/lib/error-message";
import { Video } from "@/shared/ipc";
import type { SqlDriver, SqlRow, SqlValue } from "./driver";
import { HistoryError } from "./store";

export interface NewVideo {
  readonly compositionId: string;
  readonly name: string;
  readonly projectId: string;
}

export interface VideoStore {
  readonly create: (input: NewVideo) => Effect.Effect<Video, HistoryError>;
  readonly find: (id: string) => Effect.Effect<Video, HistoryError>;
  readonly list: (
    projectId: string
  ) => Effect.Effect<readonly Video[], HistoryError>;
  readonly reconcile: (
    projectId: string,
    compositions: readonly string[]
  ) => Effect.Effect<readonly Video[], HistoryError>;
  readonly remove: (id: string) => Effect.Effect<boolean, HistoryError>;
  readonly rename: (
    id: string,
    name: string
  ) => Effect.Effect<Video, HistoryError>;
  readonly restore: (id: string) => Effect.Effect<Video, HistoryError>;
  readonly taken: (
    projectId: string
  ) => Effect.Effect<readonly string[], HistoryError>;
}

export const VideoStore = Context.Service<VideoStore>("sidecar/VideoStore");

const COLUMNS =
  "id, project_id, composition_id, name, present, created_at, updated_at, deleted_at" as const;

const BY_LAST_SESSION = `SELECT ${COLUMNS} FROM video
   WHERE project_id = ? AND deleted_at IS NULL
   ORDER BY COALESCE(
     (SELECT MAX(updated_at) FROM session WHERE video_id = video.id),
     created_at
   ) DESC, rowid DESC` as const;

const decodeVideo = Schema.decodeUnknownEffect(Video);

const failed = (cause: unknown) =>
  new HistoryError({ message: errorMessage(cause) });

function attempt<A>(thunk: () => A): Effect.Effect<A, HistoryError> {
  return Effect.try({ catch: failed, try: thunk });
}

export function make(driver: SqlDriver): VideoStore {
  const read = (id: string) =>
    attempt(() =>
      driver.all(`SELECT ${COLUMNS} FROM video WHERE id = ?`, [id])
    ).pipe(Effect.flatMap((rows) => only(rows, `there is no video ${id}`)));

  const listing = (projectId: string) =>
    attempt(() => driver.all(BY_LAST_SESSION, [projectId])).pipe(
      Effect.flatMap((rows) => Effect.forEach(rows, videoOf))
    );

  const stamp = (id: string, sql: string, params: readonly SqlValue[]) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;

      yield* attempt(() => driver.run(sql, [...params, now, id]));

      return yield* read(id);
    });

  return {
    create: (input) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const id = yield* Effect.sync(() => crypto.randomUUID());

        yield* attempt(() =>
          driver.run(
            `INSERT INTO video (${COLUMNS}) VALUES (?, ?, ?, ?, 1, ?, ?, NULL)`,
            [id, input.projectId, input.compositionId, input.name, now, now]
          )
        );

        return yield* read(id);
      }),

    find: read,

    list: listing,

    // The bundle is the only thing that knows which compositions really
    // exist; the rows are what the pane can draw before it has compiled.
    // A row the bundle does not name is marked absent rather than deleted,
    // and a row the person deleted is never resurrected by one.
    reconcile: (projectId, compositions) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;

        const known = yield* attempt(() =>
          driver.all("SELECT composition_id FROM video WHERE project_id = ?", [
            projectId,
          ])
        );

        const seen = new Set(known.map((row) => String(row.composition_id)));

        for (const composition of compositions) {
          if (seen.has(composition)) {
            continue;
          }
          yield* attempt(() =>
            driver.run(
              `INSERT INTO video (${COLUMNS}) VALUES (?, ?, ?, ?, 1, ?, ?, NULL)`,
              [
                crypto.randomUUID(),
                projectId,
                composition,
                composition,
                now,
                now,
              ]
            )
          );
        }

        const holes = compositions.map(() => "?").join(", ");

        yield* attempt(() =>
          driver.run(
            `UPDATE video SET present = CASE
               WHEN composition_id IN (${holes || "NULL"}) THEN 1 ELSE 0 END
             WHERE project_id = ?`,
            [...compositions, projectId]
          )
        );

        return yield* listing(projectId);
      }),

    remove: (id) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;

        const changes = yield* attempt(() =>
          driver.run(
            "UPDATE video SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
            [now, now, id]
          )
        );

        return changes > 0;
      }),

    rename: (id, name) =>
      stamp(id, "UPDATE video SET name = ?, updated_at = ? WHERE id = ?", [
        name,
      ]),

    restore: (id) =>
      stamp(
        id,
        "UPDATE video SET deleted_at = NULL, updated_at = ? WHERE id = ?",
        []
      ),

    taken: (projectId) =>
      attempt(() =>
        driver.all("SELECT composition_id FROM video WHERE project_id = ?", [
          projectId,
        ])
      ).pipe(
        Effect.map((rows) => rows.map((row) => String(row.composition_id)))
      ),
  };
}

export function broken(message: string): VideoStore {
  const fail = Effect.fail(new HistoryError({ message }));

  return {
    create: () => fail,
    find: () => fail,
    list: () => fail,
    reconcile: () => fail,
    remove: () => fail,
    rename: () => fail,
    restore: () => fail,
    taken: () => fail,
  };
}

function only(
  rows: readonly SqlRow[],
  absent: string
): Effect.Effect<Video, HistoryError> {
  const row = rows.at(0);
  return row === undefined
    ? Effect.fail(new HistoryError({ message: absent }))
    : videoOf(row);
}

function videoOf(row: SqlRow): Effect.Effect<Video, HistoryError> {
  return decodeVideo({
    compositionId: row.composition_id,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    id: row.id,
    missing: Number(row.present) === 0,
    name: row.name,
    projectId: row.project_id,
    updatedAt: row.updated_at,
  }).pipe(Effect.mapError(failed));
}
