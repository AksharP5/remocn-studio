import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURE = fileURLToPath(
  new URL("../test/fixtures/render-smoke", import.meta.url)
);

const SECONDS = 1;
const RATE = 48_000;
const TONE_HZ = 440;

const require_ = createRequire(path.join(FIXTURE, "package.json"));

interface Bundler {
  bundle: (options: Record<string, unknown>) => Promise<string>;
}

interface Renderer {
  ensureBrowser: (options: Record<string, unknown>) => Promise<unknown>;
  renderMedia: (options: Record<string, unknown>) => Promise<unknown>;
  selectComposition: (
    options: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;
}

const publicDir = path.join(FIXTURE, "public");
mkdirSync(publicDir, { recursive: true });

function wav(): Buffer {
  const samples = RATE * SECONDS;
  const body = Buffer.alloc(samples * 2);

  for (let at = 0; at < samples; at += 1) {
    const value = Math.round(
      Math.sin((2 * Math.PI * TONE_HZ * at) / RATE) * 0.4 * 32_767
    );
    body.writeInt16LE(value, at * 2);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + body.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(body.length, 40);

  return Buffer.concat([header, body]);
}

const tone = path.join(publicDir, "tone.wav");
const clip = path.join(publicDir, "clip.mp4");

if (existsSync(tone)) {
  process.stdout.write("tone.wav is already there\n");
} else {
  writeFileSync(tone, wav());
  process.stdout.write("wrote tone.wav\n");
}

if (existsSync(clip)) {
  process.stdout.write("clip.mp4 is already there\n");
} else {
  const { bundle } = require_("@remotion/bundler") as Bundler;
  const { ensureBrowser, renderMedia, selectComposition } = require_(
    "@remotion/renderer"
  ) as Renderer;

  process.stdout.write("compiling the fixture to render its own footage…\n");

  const serveUrl = await bundle({
    entryPoint: path.join(FIXTURE, "src/index.ts"),
    onProgress: () => undefined,
  });

  await ensureBrowser({ logLevel: "error" });

  const composition = await selectComposition({
    chromiumOptions: { gl: "angle" },
    id: "Clip",
    logLevel: "error",
    serveUrl,
  });

  await renderMedia({
    chromiumOptions: { gl: "angle" },
    codec: "h264",
    composition,
    logLevel: "error",
    outputLocation: clip,
    overwrite: true,
    serveUrl,
  });

  process.stdout.write("wrote clip.mp4\n");
}
