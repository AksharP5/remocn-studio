import { open } from "node:fs/promises";
import { basename, extname } from "node:path";
import { formatHex8, parse } from "culori";
import { parseDocument } from "yaml";
import type { DesignImport } from "@/shared/design-import";
import { ProjectSettingsError } from "@/shared/project-config";
import { publishBrandBytes } from "./brand";

const FRONTMATTER = /^\uFEFF?---\r?\n((?:[^\n]*\n)*?)---(?:\r?\n|$)/;
const FRONT_START = /^\uFEFF?---\r?\n/;
const REFERENCE = /^\{([^{}]+)\}$/;
const LIMIT = 256 * 1024;
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const invalid = (message: string) =>
  new ProjectSettingsError({ code: "invalid-file", message });

function resolveToken(
  value: unknown,
  tokens: Record<string, unknown>,
  seen = new Set<string>()
): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const match = value.match(REFERENCE);
  if (!match) {
    return value;
  }
  const [, key] = match;
  if (seen.has(key) || seen.size > 32) {
    throw invalid(`Circular or excessive token reference: ${key}`);
  }
  seen.add(key);
  let next: unknown = tokens;
  for (const part of key.split(".")) {
    const record = object(next);
    if (!Object.hasOwn(record, part)) {
      throw invalid(`Unknown token reference: ${key}`);
    }
    next = record[part];
  }
  return resolveToken(next, tokens, seen);
}

export function parseDesignMarkdown(markdown: string) {
  if (!markdown.trim() || Buffer.byteLength(markdown) > LIMIT) {
    throw invalid("Choose a non-empty DESIGN.md smaller than 256 KB.");
  }
  const front = markdown.match(FRONTMATTER);
  if (FRONT_START.test(markdown) && !front) {
    throw invalid("The YAML front matter is missing its closing --- line.");
  }
  const doc = parseDocument(front?.[1] ?? "{}", { uniqueKeys: true });
  if (doc.errors.length || doc.warnings.length) {
    throw invalid(
      `Invalid DESIGN.md YAML: ${[...doc.errors, ...doc.warnings].map((error) => error.message).join("; ")}`
    );
  }
  const tokens = validatedTokens(doc.toJS({ maxAliasCount: 20 }));
  const warnings: string[] = [];
  if (!front) {
    warnings.push(
      "No YAML tokens. The document will be saved as design context; no brand fields are inferred from prose."
    );
  }
  if (tokens.version && tokens.version !== "alpha") {
    warnings.push(
      `Unrecognized format version: ${String(tokens.version)}. Review the imported tokens.`
    );
  }
  const colors = parseColors(tokens, warnings);
  const fonts = parseFonts(tokens, warnings);
  if (fonts.length) {
    warnings.push(
      "Font names do not include font files. Add the required local files or download them from Google Fonts after importing."
    );
  }
  return {
    colors,
    fonts,
    warnings,
    ...(typeof tokens.name === "string" && tokens.name.trim()
      ? { name: tokens.name.trim() }
      : {}),
  };
}

export async function importDesignMarkdown(
  root: string,
  path: string
): Promise<DesignImport> {
  if (extname(path).toLowerCase() !== ".md") {
    throw invalid("Choose a Markdown (.md) file.");
  }
  const handle = await open(path, "r");
  let bytes: Buffer;
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > LIMIT) {
      throw invalid("Choose a regular DESIGN.md file smaller than 256 KB.");
    }
    const buffer = Buffer.alloc(LIMIT + 1);
    let bytesRead = 0;
    while (bytesRead < buffer.length) {
      // biome-ignore lint/performance/noAwaitInLoops: Read sequential chunks within a fixed memory bound.
      const chunk = await handle.read(
        buffer,
        bytesRead,
        buffer.length - bytesRead,
        bytesRead
      );
      if (!chunk.bytesRead) {
        break;
      }
      bytesRead += chunk.bytesRead;
    }
    if (bytesRead > LIMIT) {
      throw invalid("DESIGN.md exceeds 256 KB.");
    }
    bytes = buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
  const markdown = new TextDecoder("utf-8", {
    fatal: true,
    ignoreBOM: true,
  }).decode(bytes);
  const parsed = parseDesignMarkdown(markdown);
  const file = await publishBrandBytes(
    root,
    basename(path),
    bytes,
    basename(path)
  );
  return { ...parsed, document: { file, markdown } };
}

function parseColors(tokens: Record<string, unknown>, warnings: string[]) {
  const colors: Record<string, string> = {};
  for (const [key, raw] of Object.entries(object(tokens.colors))) {
    const value = resolveToken(raw, tokens);
    const parsed = typeof value === "string" ? parse(value) : undefined;
    if (!parsed) {
      warnings.push(
        `Color ${key} is unsupported and was skipped: ${String(value)}`
      );
      continue;
    }
    const hex = formatHex8(parsed);
    Object.defineProperty(colors, key, {
      enumerable: true,
      value: hex.endsWith("ff") ? hex.slice(0, 7) : hex,
    });
  }
  return colors;
}

function parseFonts(tokens: Record<string, unknown>, warnings: string[]) {
  const fonts: { token: string; family: string; weight: string }[] = [];
  for (const [token, raw] of Object.entries(object(tokens.typography))) {
    const font = object(resolveToken(raw, tokens));
    const family = resolveToken(font.fontFamily, tokens);
    if (typeof family !== "string" || !family.trim()) {
      warnings.push(
        `Typography ${token} has no usable fontFamily and was skipped.`
      );
      continue;
    }
    fonts.push({
      family: family.trim(),
      token,
      weight: String(resolveToken(font.fontWeight, tokens) ?? "Not specified"),
    });
  }
  return fonts;
}

function validatedTokens(parsedTokens: unknown): Record<string, unknown> {
  if (
    parsedTokens !== null &&
    (typeof parsedTokens !== "object" || Array.isArray(parsedTokens))
  ) {
    throw invalid("DESIGN.md front matter must be a YAML mapping.");
  }
  const tokens = object(parsedTokens);
  for (const key of ["colors", "typography"]) {
    if (
      tokens[key] !== undefined &&
      (tokens[key] === null ||
        typeof tokens[key] !== "object" ||
        Array.isArray(tokens[key]))
    ) {
      throw invalid(`${key} must be a mapping of named tokens.`);
    }
  }
  return tokens;
}
