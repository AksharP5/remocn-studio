import { randomBytes } from "node:crypto";
import { constants, existsSync } from "node:fs";
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { Effect, type Scope } from "effect";
import { errorMessage } from "@/lib/error-message";
import { PreviewError } from "./project";

export const JOB_BASE = "/__remocn/job";

export const JOBS_DIR = "jobs";

export interface Pinned {
  readonly base: string;
  readonly id: string;
  readonly outDir: string;
  readonly publicDir: string | null;
  readonly staticBase: string;
}

export interface JobRegistry {
  readonly add: (job: Pinned) => void;
  readonly byStatic: (pathname: string) => Pinned | null;
  readonly of: (id: string) => Pinned | null;
  readonly remove: (id: string) => void;
}

export function makeJobRegistry(): JobRegistry {
  const held = new Map<string, Pinned>();

  return {
    add: (job) => {
      held.set(job.id, job);
    },
    byStatic: (pathname) => {
      for (const job of held.values()) {
        if (pathname.startsWith(`${job.staticBase}/`)) {
          return job;
        }
      }
      return null;
    },
    of: (id) => held.get(id) ?? null,
    remove: (id) => {
      held.delete(id);
    },
  };
}

export function jobPath(pathname: string): { id: string; rest: string } | null {
  if (!pathname.startsWith(`${JOB_BASE}/`)) {
    return null;
  }

  const [id, ...rest] = pathname.slice(JOB_BASE.length + 1).split("/");

  if (id === undefined || id.length === 0) {
    return null;
  }

  return { id, rest: rest.join("/") };
}

export interface PinInput {
  readonly jobsDir: string;
  readonly outDir: string;
  readonly publicDir: string;
  readonly registry: JobRegistry;
}

export function pinBundle(
  input: PinInput
): Effect.Effect<Pinned, PreviewError, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.tryPromise({
      catch: (cause) =>
        new PreviewError({
          message: `the studio could not take a copy of the compiled project to render from: ${errorMessage(cause)}`,
        }),
      try: async () => {
        const id = randomBytes(6).toString("hex");
        const dir = path.join(input.jobsDir, id);

        await sweep(input.jobsDir);
        await mkdir(dir, { recursive: true });

        const outDir = path.join(dir, "bundle");
        await clone(input.outDir, outDir);

        const publicDir = existsSync(input.publicDir)
          ? path.join(dir, "public")
          : null;

        if (publicDir !== null) {
          await clone(input.publicDir, publicDir);
        }

        const job: Pinned = {
          base: `${JOB_BASE}/${id}`,
          id,
          outDir,
          publicDir,
          staticBase: `/pinned-${id}`,
        };

        input.registry.add(job);

        return job;
      },
    }),
    (job) =>
      Effect.promise(async () => {
        input.registry.remove(job.id);
        await rm(path.join(input.jobsDir, job.id), {
          force: true,
          recursive: true,
        }).catch(() => undefined);
      })
  );
}

async function clone(from: string, to: string): Promise<void> {
  await cp(from, to, {
    force: true,
    mode: constants.COPYFILE_FICLONE,
    recursive: true,
  });
}

async function sweep(jobsDir: string): Promise<void> {
  if (!existsSync(jobsDir)) {
    return;
  }

  const stale = await readdir(jobsDir).catch(() => []);

  await Promise.all(
    stale.map((name) =>
      rm(path.join(jobsDir, name), { force: true, recursive: true }).catch(
        () => undefined
      )
    )
  );
}

export function jobServeUrl(port: number, job: Pinned): string {
  return `http://127.0.0.1:${port}${job.base}/index.html`;
}
