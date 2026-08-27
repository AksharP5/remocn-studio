/**
 * Uploads the sourcemaps a crash report needs to be readable, then removes
 * the ones that must not ship.
 *
 * **Where this runs is the whole design.** Sentry matches a minified frame to
 * a map by a *debug id* that `sentry-cli sourcemaps inject` writes into the
 * built JavaScript itself, so the inject has to be the last thing that touches
 * those bytes. `tauri-action` offers no hook between its
 * `beforeBuildCommand` and the bundling that copies resources into the `.app`
 * — but `beforeBuildCommand` is `tauri:before-build`, which is this repo's own
 * script, so this is the last line of it. Run anywhere else, a later rebuild
 * would overwrite the debug id and every uploaded map would match nothing.
 *
 * Doing nothing is the normal case: with no `SENTRY_AUTH_TOKEN` — which is
 * every local build and every build until #268's Sentry project exists — it
 * uploads nothing and still does the one thing that is not optional, which is
 * making sure `out/` ships no `.map` files.
 *
 * The sidecar half needs no inject at all: `bun build --sourcemap=external`
 * already writes a `//# debugId=` line into the bundle and the matching id
 * into the map — measured, and the reason `sidecar:build` had to move from
 * `--outfile` to `--outdir`, which is what bun requires for an external map.
 * The inject is run over both directories anyway, because it is idempotent
 * where an id is already present and the static export has none.
 *
 * `@sentry/cli` is deliberately not a dependency: its postinstall downloads a
 * platform binary of some 20 MB, and `bun install` runs in three CI jobs that
 * would pay for it to do nothing. `bunx` fetches it on the one path that uses
 * it.
 */

import { spawn } from "node:child_process";
import { readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { crashRelease } from "@/shared/crash";

const SENTRY_CLI = "@sentry/cli@2";
const EXPORT_DIR = "out";
const SIDECAR_DIR = "sidecar-dist";

const token = process.env.SENTRY_AUTH_TOKEN ?? "";
const org = process.env.SENTRY_ORG ?? "";
const project = process.env.SENTRY_PROJECT ?? "";
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

const manifest: { version: string } = JSON.parse(
  await readFile("package.json", "utf8")
);
const release = crashRelease(manifest.version);

if (token === "" || org === "" || project === "" || dsn === "") {
  console.log(
    "sourcemaps: nothing uploaded — SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT and NEXT_PUBLIC_SENTRY_DSN are what turn this on"
  );
} else {
  // Both bundles go up under one release, which is what makes a crash that
  // starts in the webview and ends in the sidecar read as one story.
  for (const dir of [EXPORT_DIR, SIDECAR_DIR]) {
    // biome-ignore lint/performance/noAwaitInLoops: a release step, and the upload has to follow this directory's own inject
    await sentry(["sourcemaps", "inject", dir]);
    await sentry([
      "sourcemaps",
      "upload",
      "--release",
      release,
      "--strip-common-prefix",
      dir,
    ]);
  }
}

// Unconditional, and the only part of this script that is not optional. The
// static export *is* the app bundle, so a `.map` left in `out/` ships the
// studio's own sources inside every release. The sidecar's map is already
// safe — `tauri.conf.json` names `main.js` as a resource and not the file
// beside it — and is removed for the same reason rather than a different one.
await removeMaps(EXPORT_DIR);
await removeMaps(SIDECAR_DIR);

function sentry(args: readonly string[]): Promise<void> {
  const child = spawn("bunx", [SENTRY_CLI, ...args], {
    env: { ...process.env, SENTRY_ORG: org, SENTRY_PROJECT: project },
    stdio: "inherit",
  });

  return new Promise((resolve, reject) => {
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`sentry-cli ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function removeMaps(dir: string): Promise<void> {
  let entries: string[];

  try {
    entries = await readdir(dir, { recursive: true });
  } catch {
    // Nothing built here. `sidecar:build` and `next build` both run before
    // this in `tauri:before-build`, so this is a hand-run, not a failure.
    return;
  }

  let removed = 0;
  for (const entry of entries) {
    if (entry.endsWith(".map")) {
      // biome-ignore lint/performance/noAwaitInLoops: a handful of files in a release step
      await rm(join(dir, entry), { force: true });
      removed += 1;
    }
  }

  console.log(`sourcemaps: removed ${removed} map(s) from ${dir}/`);
}
