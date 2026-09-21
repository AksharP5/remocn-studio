import { Exit, Schema } from "effect";
import { StudioDocument } from "@/shared/studio-document";
import type {
  DesignFinding,
  DesignFindingCode,
  DesignSeverity,
} from "../preview/design";

export interface EasingFinding {
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
}

export type TunabilityRule =
  | "constant-easing"
  | "constant-spring"
  | "controls-not-forwarded"
  | "inert-easing"
  | "mapped-primitive-name"
  | "plain-text-element"
  | "raw-export"
  | "managed-document";

export interface TunabilityFinding {
  readonly file: string;
  readonly line: number;
  readonly rule: TunabilityRule;
  readonly snippet: string;
}

export interface TunabilitySource {
  readonly path: string;
  readonly source: string;
}

const CODE: Record<TunabilityRule, DesignFindingCode> = {
  "constant-easing": "tunability_constant_easing",
  "constant-spring": "tunability_constant_spring",
  "controls-not-forwarded": "tunability_controls_not_forwarded",
  "inert-easing": "tunability_inert_easing",
  "managed-document": "tunability_managed_document",
  "mapped-primitive-name": "tunability_mapped_primitive_name",
  "plain-text-element": "tunability_plain_text_element",
  "raw-export": "tunability_raw_export",
};

const SEVERITY: Record<TunabilityRule, DesignSeverity> = {
  "constant-easing": "error",
  "constant-spring": "info",
  "controls-not-forwarded": "error",
  "inert-easing": "info",
  "managed-document": "error",
  "mapped-primitive-name": "error",
  "plain-text-element": "warning",
  "raw-export": "error",
};

const EXPECTED: Record<TunabilityRule, string> = {
  "constant-easing":
    "every `interpolate()` takes its curve from an `easing` prop, spread in as `Easing.bezier(...easing)`",
  "constant-spring":
    "a `spring()` exposes its `damping` and `stiffness` as number props",
  "controls-not-forwarded":
    "a schema component passes its generated `controls` to its own `<Sequence controls={controls}>`",
  "inert-easing": "a curve exists only where it is sampled",
  "managed-document":
    "a valid studio.json with independent IDs, explicit values and supported versioned definitions",
  "mapped-primitive-name":
    "a `name` inside a `.map()` carries the index or the content, so it is unique in the frame",
  "plain-text-element":
    "one run of text is one named `Interactive.H1`, `Interactive.P` or `Interactive.Span` whose direct child is the string",
  "raw-export": "a file exports only the wrapped component",
};

const FIX: Record<TunabilityRule, string> = {
  "constant-easing":
    'Give the component a prop named `easing` (or ending in `Easing`), declared in its `InteractivitySchema` as `type: "array"` with `minLength` and `maxLength` of 4, `newItemDefault: 0` and a `number` item bounded `min: -0.5, max: 1.5, step: 0.01`. Default it inline to something like `[0.33, 1, 0.68, 1]` and spread it in as `Easing.bezier(...easing)`.',
  "constant-spring":
    "A `spring()` is not an easing: expose its `damping` and `stiffness` as number props with inline defaults instead of nailing the config shut.",
  "controls-not-forwarded":
    "Accept the generated `controls` prop and pass it to the component's owning `<Sequence controls={controls} outlineRef={outlineRef}>` — without it the preview has no schema to open on.",
  "inert-easing":
    "Is this curve ever sampled with the values you pass? Scope it under an enum variant — `exit: { none: {}, fade: { exitAt, exitFrames, exitEasing } }` — so the pane offers it only when it runs.",
  "managed-document":
    "Read src/lib/studio-objects-v1/README.md, repair the document, and preserve object IDs and edit history.",
  "mapped-primitive-name":
    "Give each rendered instance a `name` that is unique in the frame and equals its `data-design-id`: inside a `.map()` the name carries the index or the content.",
  "plain-text-element":
    "Make this run of text one `Interactive.H1`, `Interactive.P` or `Interactive.Span` whose direct child is the string, with its font size, weight, colour, letter spacing and line height written as literals in its own `style`, and a `name` that is unique in the frame.",
  "raw-export":
    "Export only the component `Interactive.withSchema()` returns; a raw export of the inner component renders without any `controls` and the pane never opens on it.",
};

const MESSAGE: Record<TunabilityRule, string> = {
  "constant-easing": "This timing curve is a constant, so nobody can drag it.",
  "constant-spring":
    "This spring's physics are constants, so nobody can tune the motion.",
  "controls-not-forwarded":
    "This component declares a schema and never forwards its `controls`.",
  "inert-easing": "This curve may never be sampled with the values you pass.",
  "managed-document":
    "The managed object document is missing or invalid, so its properties cannot be edited.",
  "mapped-primitive-name":
    "Every instance this `.map()` renders carries the same `name`.",
  "plain-text-element":
    "This run of text sits in a plain element, so the pane cannot name or edit it.",
  "raw-export":
    "This file exports the unwrapped component beside the wrapped one.",
};

const MANAGED_BIND = /\{\s*\.\.\.\s*[A-Za-z_$][\w$]*\.bind\s*\}/;
const MANAGED_USE = /\buseStudioObject\s*\(/;
const decodeDocument = Schema.decodeUnknownExit(StudioDocument);

const PLAIN_TAGS = new Set([
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "span",
]);

const TEXT_IDENTIFIERS = new Set([
  "children",
  "label",
  "line",
  "text",
  "title",
  "word",
]);

const EASING_KEY = /\beasing\s*:\s*/g;
const CONSTANT = /\bEasing\s*\./;
const FROM_PROP = /\.\.\./;
const TRAILING = /,\s*$/;
const BEZIER_CALL = /\bEasing\s*\.\s*bezier\s*\(([^()]*)\)/;
const IDENTIFIER = /^[A-Za-z_$][\w$.]*$/;
const TAG_NAME = /^[A-Za-z][\w.:-]*/;
const BEFORE_TAG = /[A-Za-z0-9_$)\]]/;
const SCHEMA_KEY = /(?<![\w$."'])([A-Za-z_$][\w$]*)\s*:\s*\{/g;
const ZERO_DEFAULT = /\bdefault\s*:\s*0\s*(?:,|\}|$)/;
const WITH_SCHEMA = /Interactive\s*\.\s*withSchema/;
const FORWARDED = /controls\s*=\s*\{\s*controls\s*\}/;
const COMPONENT_ARG = /\bComponent\s*:\s*([A-Za-z_$][\w$]*)/g;
const RAW_EXPORT = /\bexport\s+(?:const|function)\s+([A-Za-z_$][\w$]*)/g;
const SPRING_CALL = /\bspring\s*\(/g;
const CONFIG_DAMPING = /\bconfig\s*:\s*\{[^{}]*\bdamping\s*:\s*-?[\d.]+/;
const TUNED_PHYSICS = /\b\w*(?:[Dd]amping|[Ss]tiffness)\s*:/g;
const MAP_CALL = /\.\s*map\s*\(/g;

const WHITESPACE = /\s/;
const WORD_CHAR = /[\w$]/;
const SELF_CLOSING = /\/\s*$/;
const TEXT_SUFFIX = /^[A-Za-z_$][\w$]*Text$/;
const BRACED = /\{([^{}]*)\}/g;
const LITERAL_NAME = /(?<![\w-])name\s*=\s*"/;

const KEYWORDS = new Set([
  "await",
  "case",
  "default",
  "do",
  "else",
  "in",
  "of",
  "return",
  "typeof",
  "void",
  "yield",
]);

/**
 * The easings this project hardcoded, which are exactly the curves the
 * properties panel can never edit.
 *
 * The vendored `remotion-interactivity` skill tells the agent to hardcode the
 * easing — correct for Remotion Studio, which rewrites the call site, and
 * wrong here, where the panel edits props at runtime. An instruction that
 * contradicts a skill the same turn loaded is a coin flip, so this is the
 * mechanical half: `design_check` reports these as findings, and the agent
 * already has to fix every finding or say why it is intentional. Nobody should
 * have to read the generated code to find out whether the panel will work.
 */
export function hardcodedEasings(
  file: string,
  source: string
): EasingFinding[] {
  return constantEasings(file, source, masked(source)).map((finding) => ({
    file: finding.file,
    line: finding.line,
    snippet: finding.snippet,
  }));
}

export function tunabilityFindings(
  files: readonly TunabilitySource[]
): TunabilityFinding[] {
  return [
    ...managedDocumentFindings(files),
    ...files
      .filter((file) => file.path !== "studio.json")
      .flatMap((file) => scan(file.path, file.source)),
  ];
}

function managedDocumentFindings(
  files: readonly TunabilitySource[]
): TunabilityFinding[] {
  const file = files.find((item) => item.path === "studio.json");
  if (!(file || files.some((item) => MANAGED_USE.test(item.source)))) {
    return [];
  }
  let problem = "studio.json is missing.";
  if (file) {
    try {
      const decoded = decodeDocument(JSON.parse(file.source), {
        onExcessProperty: "error",
      });
      if (Exit.isSuccess(decoded)) {
        return [];
      }
      problem =
        "studio.json has an unsupported schema, duplicate IDs, invalid parents or property values.";
    } catch {
      problem = "studio.json is not valid JSON.";
    }
  }
  return [
    {
      file: "studio.json",
      line: 1,
      rule: "managed-document",
      snippet: problem,
    },
  ];
}

export function tunabilityDesignFindings(
  findings: readonly TunabilityFinding[]
): DesignFinding[] {
  return findings.map((finding) => ({
    bbox: null,
    code: CODE[finding.rule],
    expected: EXPECTED[finding.rule],
    fix: FIX[finding.rule],
    frames: [],
    message: MESSAGE[finding.rule],
    observed: `${finding.file}:${finding.line} — ${finding.snippet}`,
    selector: null,
    severity: SEVERITY[finding.rule],
    text: null,
  }));
}

function scan(file: string, source: string): TunabilityFinding[] {
  const code = masked(source);
  const tags = tagRuns(code);
  const keys = schemaKeys(code);

  return [
    ...constantEasings(file, source, code),
    ...constantSprings(file, source, code),
    ...plainTextElements(file, source, code, tags),
    ...mappedPrimitiveNames(file, source, code, tags),
    ...inertEasings(file, source, code, keys),
    ...unforwardedControls(file, source, code),
    ...rawExports(file, source, code),
  ].sort((left, right) => left.line - right.line);
}

function constantEasings(
  file: string,
  source: string,
  code: string
): TunabilityFinding[] {
  const found: TunabilityFinding[] = [];
  EASING_KEY.lastIndex = 0;

  for (const match of code.matchAll(EASING_KEY)) {
    const from = match.index + match[0].length;
    const value = valueAt(code, from);
    const text = source.slice(from, value);

    if (!CONSTANT.test(text) || FROM_PROP.test(text) || propFedBezier(text)) {
      continue;
    }

    found.push({
      file,
      line: lineOf(code, match.index),
      rule: "constant-easing",
      snippet: `easing: ${collapse(text).replace(TRAILING, "")}`,
    });
  }

  return found;
}

function propFedBezier(text: string): boolean {
  const call = BEZIER_CALL.exec(text);
  if (call === null) {
    return false;
  }

  const args = (call[1] ?? "")
    .split(",")
    .map((arg) => arg.trim())
    .filter((arg) => arg.length > 0);

  return args.length > 0 && args.every((arg) => IDENTIFIER.test(arg));
}

function constantSprings(
  file: string,
  source: string,
  code: string
): TunabilityFinding[] {
  const found: TunabilityFinding[] = [];
  SPRING_CALL.lastIndex = 0;

  const calls = [...code.matchAll(SPRING_CALL)].map((match) => ({
    at: match.index,
    to: closingAt(code, match.index + match[0].length - 1),
  }));

  if (calls.length === 0 || tunedPhysics(code, calls)) {
    return found;
  }

  for (const call of calls) {
    const body = code.slice(call.at, call.to);
    if (!CONFIG_DAMPING.test(body)) {
      continue;
    }

    found.push({
      file,
      line: lineOf(code, call.at),
      rule: "constant-spring",
      snippet: collapse(
        source.slice(call.at, Math.min(call.to + 1, call.at + 120))
      ),
    });
  }

  return found;
}

function tunedPhysics(
  code: string,
  calls: readonly { readonly at: number; readonly to: number }[]
): boolean {
  TUNED_PHYSICS.lastIndex = 0;

  for (const match of code.matchAll(TUNED_PHYSICS)) {
    const inside = calls.some(
      (call) => match.index > call.at && match.index < call.to
    );
    if (!inside) {
      return true;
    }
  }

  return false;
}

interface TagRun {
  readonly ancestors: readonly string[];
  readonly at: number;
  readonly children: string;
  readonly name: string;
  readonly tag: string;
}

function tagRuns(code: string): TagRun[] {
  const runs: TagRun[] = [];
  const stack: string[] = [];
  let at = 0;

  while (at < code.length) {
    const opened = code.indexOf("<", at);
    if (opened === -1) {
      break;
    }

    at =
      code[opened + 1] === "/"
        ? closeTag(code, opened, stack)
        : openTag(code, opened, stack, runs);
  }

  return runs;
}

function closeTag(code: string, opened: number, stack: string[]): number {
  const name = TAG_NAME.exec(code.slice(opened + 2))?.[0] ?? "";
  const closed = code.indexOf(">", opened);

  if (name.length > 0 && stack.at(-1) === name) {
    stack.pop();
  }

  return closed === -1 ? code.length : closed + 1;
}

function openTag(
  code: string,
  opened: number,
  stack: string[],
  runs: TagRun[]
): number {
  const name = TAG_NAME.exec(code.slice(opened + 1))?.[0] ?? "";
  if (name.length === 0 || !startsTag(code, opened)) {
    return opened + 1;
  }

  const end = openTagEnd(code, opened + 1 + name.length);
  if (end === null) {
    return opened + 1;
  }

  const next = code.indexOf("<", end.at + 1);
  runs.push({
    ancestors: [...stack],
    at: opened,
    children: end.selfClosing
      ? ""
      : code.slice(end.at + 1, next === -1 ? code.length : next),
    name,
    tag: code.slice(opened, end.at + 1),
  });

  if (!end.selfClosing) {
    stack.push(name);
  }

  return end.at + 1;
}

function startsTag(code: string, at: number): boolean {
  for (let index = at - 1; index >= 0; index -= 1) {
    const char = code[index] ?? "";
    if (WHITESPACE.test(char)) {
      continue;
    }
    if (!BEFORE_TAG.test(char)) {
      return true;
    }
    return KEYWORDS.has(wordEndingAt(code, index));
  }
  return true;
}

function wordEndingAt(code: string, at: number): string {
  let start = at;

  while (start >= 0 && WORD_CHAR.test(code[start] ?? "")) {
    start -= 1;
  }

  return code.slice(start + 1, at + 1);
}

function openTagEnd(
  code: string,
  from: number
): { at: number; selfClosing: boolean } | null {
  let depth = 0;

  for (let at = from; at < code.length; at += 1) {
    const char = code[at];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
    } else if (char === ">" && depth <= 0) {
      return { at, selfClosing: SELF_CLOSING.test(code.slice(from, at)) };
    }
  }

  return null;
}

function plainTextElements(
  file: string,
  source: string,
  code: string,
  tags: readonly TagRun[]
): TunabilityFinding[] {
  const found: TunabilityFinding[] = [];

  for (const tag of tags) {
    if (MANAGED_USE.test(code) && MANAGED_BIND.test(tag.tag)) {
      continue;
    }
    if (!PLAIN_TAGS.has(tag.name)) {
      continue;
    }
    if (tag.ancestors.some((name) => name.startsWith("Interactive."))) {
      continue;
    }
    if (!carriesText(tag.children)) {
      continue;
    }

    found.push({
      file,
      line: lineOf(code, tag.at),
      rule: "plain-text-element",
      snippet: collapse(
        source.slice(tag.at, Math.min(tag.at + 120, source.length))
      ),
    });
  }

  return found;
}

function carriesText(children: string): boolean {
  const expressions = [...children.matchAll(BRACED)];

  for (const expression of expressions) {
    const name = (expression[1] ?? "").trim();
    if (TEXT_IDENTIFIERS.has(name) || TEXT_SUFFIX.test(name)) {
      return true;
    }
  }

  const bare = children.replaceAll(/\{[^{}]*\}/g, "");
  const unclosed = bare.indexOf("{");

  return (unclosed === -1 ? bare : bare.slice(0, unclosed)).trim().length > 0;
}

function mappedPrimitiveNames(
  file: string,
  source: string,
  code: string,
  tags: readonly TagRun[]
): TunabilityFinding[] {
  const found: TunabilityFinding[] = [];
  MAP_CALL.lastIndex = 0;

  const regions = [...code.matchAll(MAP_CALL)].map((match) => ({
    from: match.index + match[0].length,
    to: closingAt(code, match.index + match[0].length - 1),
  }));

  for (const tag of tags) {
    if (!tag.name.startsWith("Interactive.")) {
      continue;
    }
    if (!LITERAL_NAME.test(tag.tag)) {
      continue;
    }
    if (!regions.some((region) => tag.at > region.from && tag.at < region.to)) {
      continue;
    }

    found.push({
      file,
      line: lineOf(code, tag.at),
      rule: "mapped-primitive-name",
      snippet: collapse(source.slice(tag.at, tag.at + tag.tag.length)),
    });
  }

  return found;
}

interface SchemaKey {
  readonly at: number;
  readonly name: string;
  readonly to: number;
  readonly zeroDefault: boolean;
}

function schemaKeys(code: string): SchemaKey[] {
  const keys: SchemaKey[] = [];
  SCHEMA_KEY.lastIndex = 0;

  for (const match of code.matchAll(SCHEMA_KEY)) {
    const open = match.index + match[0].length - 1;
    const to = closingAt(code, open);
    const body = code.slice(open + 1, to);

    keys.push({
      at: match.index,
      name: match[1] ?? "",
      to,
      zeroDefault: ZERO_DEFAULT.test(topLevel(body)),
    });
  }

  return keys;
}

function topLevel(body: string): string {
  let depth = 0;
  let out = "";

  for (const char of body) {
    if (char === "{" || char === "[") {
      depth += 1;
    } else if (char === "}" || char === "]") {
      depth -= 1;
    } else if (depth === 0) {
      out += char;
    }
  }

  return out;
}

function inertEasings(
  file: string,
  source: string,
  code: string,
  keys: readonly SchemaKey[]
): TunabilityFinding[] {
  const found: TunabilityFinding[] = [];
  const zero = new Set(
    keys.filter((key) => key.zeroDefault).map((key) => key.name)
  );

  for (const key of keys) {
    if (!key.name.endsWith("Easing") || key.name === "Easing") {
      continue;
    }

    const prefix = key.name.slice(0, -"Easing".length);
    if (prefix.length === 0) {
      continue;
    }

    const windows = [
      `${prefix}At`,
      `${prefix}Frames`,
      `${prefix}In`,
      `${prefix}Out`,
    ];
    const inert =
      windows.some((name) => zero.has(name)) ||
      onlyBehindTernary(code, key, prefix);

    if (!inert) {
      continue;
    }

    found.push({
      file,
      line: lineOf(code, key.at),
      rule: "inert-easing",
      snippet: collapse(
        source.slice(key.at, Math.min(key.at + 90, source.length))
      ),
    });
  }

  return found;
}

function onlyBehindTernary(
  code: string,
  key: SchemaKey,
  prefix: string
): boolean {
  const uses = [
    ...code.matchAll(
      new RegExp(
        `Easing\\s*\\.\\s*bezier\\s*\\(\\s*\\.\\.\\.\\s*${key.name}\\b`,
        "g"
      )
    ),
  ].filter((use) => use.index > key.to);

  if (uses.length === 0) {
    return false;
  }

  const guard = new RegExp(`${prefix}(?![a-z])`, "i");

  return uses.every((use) => {
    const before = code.slice(Math.max(0, use.index - 300), use.index);
    const question = before.lastIndexOf("?");
    if (question === -1) {
      return false;
    }
    return guard.test(before.slice(Math.max(0, question - 120), question));
  });
}

function unforwardedControls(
  file: string,
  source: string,
  code: string
): TunabilityFinding[] {
  const declared = WITH_SCHEMA.exec(code);

  if (declared === null || FORWARDED.test(code)) {
    return [];
  }

  return [
    {
      file,
      line: lineOf(code, declared.index),
      rule: "controls-not-forwarded",
      snippet: collapse(
        source.slice(
          declared.index,
          Math.min(declared.index + 90, source.length)
        )
      ),
    },
  ];
}

function rawExports(
  file: string,
  source: string,
  code: string
): TunabilityFinding[] {
  COMPONENT_ARG.lastIndex = 0;
  RAW_EXPORT.lastIndex = 0;

  const wrapped = new Set(
    [...code.matchAll(COMPONENT_ARG)].map((match) => match[1] ?? "")
  );

  if (wrapped.size === 0) {
    return [];
  }

  return [...code.matchAll(RAW_EXPORT)]
    .filter((match) => wrapped.has(match[1] ?? ""))
    .map((match) => ({
      file,
      line: lineOf(code, match.index),
      rule: "raw-export" as const,
      snippet: collapse(
        source.slice(match.index, match.index + match[0].length)
      ),
    }));
}

function valueAt(code: string, from: number): number {
  let depth = 0;

  for (let at = from; at < code.length; at += 1) {
    const char = code[at];
    if (char === "(" || char === "[" || char === "{") {
      depth += 1;
    } else if (char === ")" || char === "]" || char === "}") {
      if (depth === 0) {
        return at;
      }
      depth -= 1;
    } else if (depth === 0 && (char === "," || char === "\n")) {
      return at;
    }
  }

  return code.length;
}

function closingAt(code: string, open: number): number {
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const close = pairs[code[open] ?? ""] ?? ")";
  let depth = 0;

  for (let at = open; at < code.length; at += 1) {
    const char = code[at];
    if (char === code[open]) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return at;
      }
    }
  }

  return code.length;
}

interface MaskedRegion {
  readonly filler: string;
  readonly from: number;
  readonly next: number;
  readonly to: number;
}

function masked(source: string): string {
  const out = source.split("");
  let at = 0;

  while (at < source.length) {
    const region = regionAt(source, at);

    if (region === null) {
      at += 1;
      continue;
    }

    for (let index = region.from; index < region.to; index += 1) {
      if (out[index] !== "\n") {
        out[index] = region.filler;
      }
    }
    at = Math.max(region.next, at + 1);
  }

  return out.join("");
}

function regionAt(source: string, at: number): MaskedRegion | null {
  const char = source[at];

  if (char === "/" && source[at + 1] === "/") {
    const line = source.indexOf("\n", at);
    const to = line === -1 ? source.length : line;
    return { filler: " ", from: at, next: to, to };
  }

  if (char === "/" && source[at + 1] === "*") {
    const closed = source.indexOf("*/", at + 2);
    const to = closed === -1 ? source.length : closed + 2;
    return { filler: " ", from: at, next: to, to };
  }

  if (char === '"' || char === "'") {
    const end = quoteEnd(source, at);
    return end === -1
      ? null
      : { filler: "x", from: at + 1, next: end + 1, to: end };
  }

  if (char === "`") {
    const end = templateEnd(source, at);
    const to = end === -1 ? source.length : end;
    return { filler: "x", from: at + 1, next: to + 1, to };
  }

  return null;
}

function quoteEnd(source: string, at: number): number {
  const quote = source[at];

  for (let index = at + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "\n") {
      return -1;
    }
    if (char === quote) {
      return index;
    }
  }

  return -1;
}

function templateEnd(source: string, at: number): number {
  let depth = 0;

  for (let index = at + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (char === "`" && depth === 0) {
      return index;
    }
  }

  return -1;
}

function collapse(text: string): string {
  return text.replaceAll(/\s+/g, " ").trim();
}

function lineOf(source: string, index: number): number {
  let line = 1;

  for (let at = 0; at < index; at += 1) {
    if (source[at] === "\n") {
      line += 1;
    }
  }

  return line;
}
