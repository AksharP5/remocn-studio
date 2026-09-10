import { afterEach, describe, expect, it } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Effect } from "effect";
import {
  JOB_BASE,
  jobPath,
  jobServeUrl,
  makeJobRegistry,
  type Pinned,
  pinBundle,
} from "./job";

const made: string[] = [];

function scratch(): string {
  const created = mkdtempSync(path.join(tmpdir(), "remocn-job-"));
  made.push(created);
  return created;
}

afterEach(() => {
  for (const created of made.splice(0)) {
    rmSync(created, { force: true, recursive: true });
  }
});

function project(): {
  jobsDir: string;
  outDir: string;
  publicDir: string;
  root: string;
} {
  const root = scratch();
  const outDir = path.join(root, "bundle");
  const publicDir = path.join(root, "public");
  const jobsDir = path.join(root, "jobs");

  mkdirSync(outDir, { recursive: true });
  mkdirSync(path.join(publicDir, "library"), { recursive: true });
  writeFileSync(path.join(outDir, "bundle.js"), "the first build");
  writeFileSync(path.join(publicDir, "library", "clip.mp4"), "the first clip");

  return { jobsDir, outDir, publicDir, root };
}

function held(input: ReturnType<typeof project>) {
  const registry = makeJobRegistry();

  return {
    registry,
    take: <A>(use: (job: Pinned) => Effect.Effect<A>) =>
      Effect.runPromise(
        Effect.scoped(
          Effect.flatMap(
            pinBundle({
              jobsDir: input.jobsDir,
              outDir: input.outDir,
              publicDir: input.publicDir,
              registry,
            }),
            use
          )
        )
      ),
  };
}

describe("pinBundle", () => {
  it("keeps the bytes the job started with when the project changes under it", async () => {
    const files = project();
    const { take } = held(files);

    const read = await take((job) =>
      Effect.sync(() => {
        writeFileSync(path.join(files.outDir, "bundle.js"), "a later build");
        writeFileSync(
          path.join(files.publicDir, "library", "clip.mp4"),
          "a later clip"
        );

        return {
          bundle: readFileSync(path.join(job.outDir, "bundle.js"), "utf8"),
          clip: readFileSync(
            path.join(job.publicDir ?? "", "library", "clip.mp4"),
            "utf8"
          ),
        };
      })
    );

    expect(read.bundle).toBe("the first build");
    expect(read.clip).toBe("the first clip");
  });

  it("puts the copy back once the job is over", async () => {
    const files = project();
    const { take } = held(files);

    const where = await take((job) => Effect.succeed(job.outDir));

    expect(existsSync(where)).toBe(false);
    expect(readdirSync(files.jobsDir)).toEqual([]);
  });

  it("is findable while it runs and forgotten afterwards", async () => {
    const files = project();
    const { registry, take } = held(files);

    const id = await take((job) =>
      Effect.sync(() => {
        expect(registry.of(job.id)).not.toBeNull();
        expect(
          registry.byStatic(`${job.staticBase}/library/clip.mp4`)?.id
        ).toBe(job.id);
        return job.id;
      })
    );

    expect(registry.of(id)).toBeNull();
  });

  it("sweeps a copy an earlier crash left behind", async () => {
    const files = project();
    mkdirSync(path.join(files.jobsDir, "stale"), { recursive: true });
    writeFileSync(path.join(files.jobsDir, "stale", "bundle.js"), "old");

    const { take } = held(files);

    const alone = await take((job) =>
      Effect.sync(() =>
        readdirSync(files.jobsDir).filter((name) => name !== job.id)
      )
    );

    expect(alone).toEqual([]);
  });

  it("takes a project with no public folder", async () => {
    const files = project();
    rmSync(files.publicDir, { force: true, recursive: true });

    const { take } = held(files);

    const answered = await take((job) => Effect.succeed(job.publicDir));

    expect(answered).toBeNull();
  });

  it("gives each job its own static base", async () => {
    const files = project();
    const { take } = held(files);

    const first = await take((job) => Effect.succeed(job.staticBase));
    const second = await take((job) => Effect.succeed(job.staticBase));

    expect(first).not.toBe(second);
  });
});

describe("jobPath", () => {
  it("splits the id from what it is asking for", () => {
    expect(jobPath(`${JOB_BASE}/abc123/bundle.js`)).toEqual({
      id: "abc123",
      rest: "bundle.js",
    });
    expect(jobPath(`${JOB_BASE}/abc123/index.html`)?.rest).toBe("index.html");
    expect(jobPath(`${JOB_BASE}/abc123/`)?.rest).toBe("");
  });

  it("answers nothing for a path that is not a job's", () => {
    expect(jobPath("/__remocn/render/index.html")).toBeNull();
    expect(jobPath(`${JOB_BASE}/`)).toBeNull();
    expect(jobPath("/bundle.js")).toBeNull();
  });
});

describe("jobServeUrl", () => {
  it("points the renderer at the copy rather than at the live bundle", () => {
    const job: Pinned = {
      base: `${JOB_BASE}/abc`,
      id: "abc",
      outDir: "/tmp/bundle",
      publicDir: null,
      staticBase: "/pinned-abc",
    };

    expect(jobServeUrl(4321, job)).toBe(
      `http://127.0.0.1:4321${JOB_BASE}/abc/index.html`
    );
  });
});
