// biome-ignore-all lint/performance/noAwaitInLoops: Sequential file IO bounds memory and preserves verification order.
import type { BrandFont } from "@/shared/brand";
import { ProjectSettingsError } from "@/shared/project-config";
import { publishBrandBytes } from "./brand";

async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new ProjectSettingsError({
      code: "invalid-file",
      message: `Font download failed (${response.status}). Check the family and requested weights.`,
    });
  }
  const data = new Uint8Array(await response.arrayBuffer());
  if (data.length > 40 * 1024 * 1024) {
    throw new ProjectSettingsError({
      code: "invalid-file",
      message: "Font download exceeds 40 MB.",
    });
  }
  return data;
}

// CSS2 documentation: https://developers.google.com/fonts/docs/css2
// Request full faces (no text subsetting), keep all returned subsets locally.
export async function googleFont(
  root: string,
  family: string,
  weights: string,
  italic = false
): Promise<typeof BrandFont.Type> {
  if (!(PATTERN_1.test(family) && PATTERN_2.test(weights))) {
    throw new ProjectSettingsError({
      code: "invalid-file",
      message: "Enter a family and weights such as 400;700 or 100..900.",
    });
  }
  const url = new URL("https://fonts.googleapis.com/css2");
  url.searchParams.set(
    "family",
    italic
      ? `${family}:ital,wght@${weights
          .split(";")
          .map((weight) => `1,${weight}`)
          .join(";")}`
      : `${family}:wght@${weights}`
  );
  const css = new TextDecoder().decode(await download(url.href));
  const files: (typeof BrandFont.Type)["files"][number][] = [];
  for (const match of css.matchAll(PATTERN_3)) {
    const [, body] = match;
    const source = body.match(PATTERN_4)?.[1];
    if (!source || new URL(source).hostname !== "fonts.gstatic.com") {
      continue;
    }
    const weight = body.match(PATTERN_5)?.[1] ?? "400";
    const bytes = await download(source);
    const signature = Buffer.from(bytes).subarray(0, 4).toString();
    const extension =
      ({ wOF2: "woff2", wOFF: "woff" } as Record<string, string>)[signature] ??
      "ttf";
    const file = await publishBrandBytes(
      root,
      `${family.replaceAll(" ", "-")}-${files.length}.${extension}`,
      bytes,
      source
    );
    const unicodeRange = body.match(PATTERN_6)?.[1];
    const range = weight.split(" ").map(Number);
    files.push({
      ...file,
      ...(range.length === 2 && range.every(Number.isFinite)
        ? { axes: { wght: [range[0], range[1]] as readonly [number, number] } }
        : {}),
      style: italic ? "italic" : "normal",
      weight,
      ...(unicodeRange ? { unicodeRange } : {}),
    });
  }
  if (files.length === 0) {
    throw new ProjectSettingsError({
      code: "invalid-file",
      message: "Google Fonts returned no supported font files.",
    });
  }
  const source = await publishBrandBytes(
    root,
    "google-fonts-source.txt",
    new TextEncoder().encode(`${url.href}\n\n${css}`),
    url.href
  );
  return {
    fallback: "sans-serif",
    family,
    files,
    licenses: [],
    sources: [source],
  };
}

const PATTERN_1 = /^[\p{L}\p{N} -]+$/u;
const PATTERN_2 = /^\d{2,4}(\.\.\d{2,4})?(;\d{2,4}(\.\.\d{2,4})?)*$/;
const PATTERN_3 = /@font-face\s*\{([^}]+)\}/g;
const PATTERN_4 = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/;
const PATTERN_5 = /font-weight:\s*([^;]+);/;
const PATTERN_6 = /unicode-range:\s*([^;]+);/;
