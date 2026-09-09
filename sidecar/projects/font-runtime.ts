import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import type { ProjectBrandSnapshot } from "@/shared/brand";
import { remotionRootOf } from "../preview/project";
import { snapshotPath } from "./brand";
import { contained, hashBytes } from "./config";

export async function writeFontRuntime(
  root: string,
  slug: string,
  snapshot: ProjectBrandSnapshot
) {
  const publicRoot = join(remotionRootOf(root), "public");
  const fonts = Object.entries(snapshot.brand?.typography ?? {}).flatMap(
    ([role, font]) => {
      const family = `brand-${hashBytes(JSON.stringify(font.files)).slice(0, 24)}`;
      return font.files.map((file) => ({
        family,
        path: relative(publicRoot, join(root, file.path)),
        role,
        style: file.style,
        unicodeRange: file.unicodeRange ?? "U+0-10FFFF",
        weight: file.weight,
      }));
    }
  );
  const filename = `brand-fonts-${snapshot.hash}.ts`;
  const actualRoot = remotionRootOf(root);
  const path = await contained(
    actualRoot,
    join(dirname(snapshotPath(actualRoot, slug)), filename)
  );
  await mkdir(dirname(path), { recursive: true });
  const source = `// Generated from this video's immutable brand snapshot. No network dependencies.
import { useEffect, useState } from "react";
import { useDelayRender, staticFile } from "remotion";
const fonts: { family: string; path: string; weight: string; style: string; unicodeRange: string }[] = ${JSON.stringify(fonts)};
let loaded: Promise<void> | undefined;
function load() {
  loaded ??= Promise.all(fonts.map(async (font) => {
    const face = new FontFace(font.family, "url(" + JSON.stringify(staticFile(font.path)) + ")", { weight: font.weight, style: font.style, unicodeRange: font.unicodeRange });
    await face.load();
    document.fonts.add(face);
  })).then(() => undefined);
  return loaded;
}
export function useBrandFonts() {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Loading local brand fonts"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    load().then(() => { if (active) { setReady(true); continueRender(handle); } }).catch(cancelRender);
    return () => { active = false; continueRender(handle); };
  }, [handle, continueRender, cancelRender]);
  return ready;
}
`;
  try {
    await writeFile(path, source, { flag: "wx" });
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code !== "EEXIST" ||
      (await readFile(path, "utf8")) !== source
    ) {
      throw error;
    }
  }
  return { filename, fonts };
}

// Only called immediately after expanding Studio's own starter template. Never
// applied as a codemod to an existing user's composition.
export async function brandStarter(
  root: string,
  slug: string,
  snapshot: ProjectBrandSnapshot
) {
  if (snapshot.brand === null) {
    return;
  }
  const runtime = await writeFontRuntime(root, slug, snapshot);
  const path = await contained(
    root,
    join(dirname(snapshotPath(root, slug)), "index.tsx")
  );
  let source = await readFile(path, "utf8");
  source = `import { useBrandFonts } from ${JSON.stringify(`./${runtime.filename.slice(0, -3)}`)};\n${source}`;
  source = source.replace(
    "export default function Video() {",
    "export default function Video() {\n  const fontsReady = useBrandFonts();\n  if (!fontsReady) return null;"
  );
  const { colors } = snapshot.brand;
  for (const [original, next] of [
    ["#ffffff", colors.foreground],
    ["#9a94b8", colors.foreground],
    ["#141318", colors.background],
    ["#8b7bff", colors.accent],
  ]) {
    if (next) {
      source = source.replaceAll(original, next);
    }
  }
  const display = runtime.fonts.find((font) => font.role === "display");
  if (display) {
    source = source.replaceAll(
      '"system-ui, sans-serif"',
      JSON.stringify(
        `${display.family}, ${snapshot.brand.typography.display?.fallback || "sans-serif"}`
      )
    );
  }
  await writeFile(path, source);
}
