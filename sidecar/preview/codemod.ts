import { readFile } from "node:fs/promises";
import { Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import {
  isTypeScriptFile,
  NO_CALL_SITE,
  NOT_TYPESCRIPT,
} from "@/shared/codemod";
import type {
  CodeEdit,
  CodeNodePath,
  CodePropStatus,
  CodeTarget,
  CodeTargetStatus,
  CodeWritten,
  VideoConfigValues,
} from "@/shared/ipc";
import { importFrom, PreviewError, resolveNested } from "./project";

/**
 * The project's own `@remotion/studio-codemods`, reached the way every other
 * Remotion package here is: resolved from the project, never bundled. Only the
 * three public entry points the studio uses are named, and only as far as it
 * calls them — the shapes inside are Remotion's.
 */
export interface Codemods {
  readonly computeSequencePropsSubscriptionFromContent: (input: {
    absolutePath: string;
    assetKeys: string[];
    componentIdentity: string | null;
    effects: string[][];
    fileContents: string;
    keys: string[];
    line: number;
    preferredNodePath: null;
    videoConfigValues: VideoConfigValues;
  }) => SubscriptionAnswer;
  readonly deleteJsxNode?: (input: {
    input: string;
    nodePath: readonly (number | string)[];
  }) => Promise<{ logLine: number; output: string }>;
  readonly updateMultipleSequenceProps: (input: {
    changes: {
      nodePath: readonly (number | string)[];
      schema: unknown;
      updates: {
        defaultValue: unknown;
        key: string;
        value: unknown;
      }[];
      videoConfigValues: VideoConfigValues | null;
    }[];
    input: string;
  }) => { output: string; results: { logLine: number }[] };
  readonly updateSequenceKeyframesAst: (input: {
    input: string;
    nodePath: readonly (number | string)[];
    schema: unknown;
    updates: {
      key: string;
      operation: { frame: number; type: "add"; value: unknown };
    }[];
    videoConfigValues: VideoConfigValues | null;
  }) => { logLine: number; serialized: string };
}

interface StatusEntry {
  readonly status: string;
}

type SubscriptionAnswer =
  | {
      nodePath: CodeNodePath;
      status: { props: Record<string, StatusEntry> };
      success: true;
    }
  | { status: { reason: string }; success: false };

const SPECIFIER = "@remotion/studio-codemods";

/**
 * The codemods are a dependency of `@remotion/studio`, which is a dependency of
 * `@remotion/cli`, so a hoisting installer puts them at the project's root and
 * a strict one does not. The nested lookup is what makes a pnpm project answer
 * the same as a bun one.
 */
export function codemodsOf(
  root: string
): Effect.Effect<Codemods, PreviewError> {
  return importFrom<Codemods>(root, SPECIFIER).pipe(
    Effect.catch(() =>
      resolveNested<Codemods>(root, "@remotion/studio", SPECIFIER)
    ),
    Effect.mapError(
      () =>
        new PreviewError({
          message: `${SPECIFIER} is not installed in this project, so the studio cannot write values into its code. It ships with Remotion 4.0.513 and later.`,
        })
    )
  );
}

export function statusesOf(
  codemods: Codemods,
  targets: readonly CodeTarget[],
  video: VideoConfigValues,
  read: (file: string) => Promise<string> = (file) => readFile(file, "utf8")
): Effect.Effect<CodeTargetStatus[]> {
  return Effect.promise(async () => {
    const sources = await contentsOf(
      [...new Set(targets.map((target) => target.file))].filter(
        isTypeScriptFile
      ),
      read
    );

    return targets.map((target) => answer(codemods, target, sources, video));
  });
}

function answer(
  codemods: Codemods,
  target: CodeTarget,
  sources: ReadonlyMap<string, string | Error>,
  video: VideoConfigValues
): CodeTargetStatus {
  if (!isTypeScriptFile(target.file)) {
    return refused(target.id, NOT_TYPESCRIPT);
  }

  const source = sources.get(target.file);

  if (source === undefined) {
    return refused(target.id, "the file could not be read");
  }

  if (source instanceof Error) {
    return refused(target.id, source.message);
  }

  try {
    const found = codemods.computeSequencePropsSubscriptionFromContent({
      absolutePath: target.file,
      assetKeys: [],
      componentIdentity: target.identity,
      effects: [],
      fileContents: source,
      keys: [...target.keys],
      line: target.line,
      preferredNodePath: null,
      videoConfigValues: video,
    });

    return found.success
      ? {
          id: target.id,
          nodePath: found.nodePath,
          props: readable(found.status.props),
          reason: null,
        }
      : refused(target.id, found.status.reason);
  } catch (cause) {
    return refused(target.id, errorMessage(cause));
  }
}

function refused(id: string, reason: string): CodeTargetStatus {
  return { id, nodePath: null, props: {}, reason };
}

const KINDS = new Set(["computed", "keyframed", "static"]);

function readable(
  props: Record<string, StatusEntry>
): Record<string, CodePropStatus> {
  const out: Record<string, CodePropStatus> = {};

  for (const [key, status] of Object.entries(props)) {
    if (KINDS.has(status.status)) {
      out[key] = {
        kind: status.status as CodePropStatus["kind"],
        status,
      };
    }
  }

  return out;
}

export interface AssembledFile {
  readonly contents: string;
  readonly path: string;
}

export interface Assembled {
  readonly files: readonly AssembledFile[];
  readonly results: readonly CodeWritten[];
}

/**
 * Every edit applied in memory, grouped by the file it lands in.
 *
 * A codemod that cannot do one of a file's edits throws for the whole file, so
 * a failure is probed apart afterwards: each edit is tried alone against the
 * original text to find which one is at fault, and the ones that survive are
 * then applied together. That costs a few milliseconds and is what lets the
 * card name the change that could not be written rather than the file.
 */
export function assemble(
  codemods: Codemods,
  edits: readonly CodeEdit[],
  partial: boolean,
  read: (file: string) => Promise<string> = (file) => readFile(file, "utf8")
): Effect.Effect<Assembled> {
  return Effect.promise(async () => {
    const sources = await contentsOf(
      [...new Set(edits.map((edit) => edit.file))].filter(isTypeScriptFile),
      read
    );

    const files: AssembledFile[] = [];
    const results: CodeWritten[] = [];

    for (const [file, owned] of Map.groupBy(edits, (edit) => edit.file)) {
      const source = sources.get(file);
      const built = assembleFile(codemods, file, source, owned);

      results.push(...built.results);

      if (built.output !== null && built.output !== source) {
        files.push({ contents: built.output, path: file });
      }
    }

    const failed = results.some((result) => !result.ok);

    return { files: failed && !partial ? [] : files, results };
  });
}

interface Built {
  readonly output: string | null;
  readonly results: readonly CodeWritten[];
}

function assembleFile(
  codemods: Codemods,
  file: string,
  source: string | Error | undefined,
  edits: readonly CodeEdit[]
): Built {
  if (!isTypeScriptFile(file)) {
    return refusedFile(file, edits, NOT_TYPESCRIPT);
  }

  if (source === undefined) {
    return refusedFile(file, edits, "the file is not there");
  }

  if (source instanceof Error) {
    return refusedFile(file, edits, source.message);
  }

  const whole = applied(codemods, source, edits);
  if (whole.output !== null) {
    return { output: whole.output, results: whole.results };
  }

  const probed = edits.map((edit) => ({
    edit,
    tried: applied(codemods, source, [edit]),
  }));
  const kept = probed.filter((one) => one.tried.output !== null);

  if (kept.length === 0) {
    return refusedFile(file, edits, whole.message);
  }

  const together = applied(
    codemods,
    source,
    kept.map((one) => one.edit)
  );

  if (together.output === null) {
    return refusedFile(file, edits, together.message);
  }

  const lines = new Map(
    together.results.map((result) => [result.id, result.line])
  );

  return {
    output: together.output,
    results: probed.map((one) =>
      one.tried.output === null
        ? {
            file,
            id: one.edit.id,
            line: null,
            message: one.tried.message,
            ok: false,
          }
        : {
            file,
            id: one.edit.id,
            line: lines.get(one.edit.id) ?? null,
            message: null,
            ok: true,
          }
    ),
  };
}

function refusedFile(
  file: string,
  edits: readonly CodeEdit[],
  message: string
): Built {
  return {
    output: null,
    results: edits.map((edit) => ({
      file,
      id: edit.id,
      line: null,
      message,
      ok: false,
    })),
  };
}

interface Attempt {
  readonly message: string;
  readonly output: string | null;
  readonly results: readonly CodeWritten[];
}

function applied(
  codemods: Codemods,
  source: string,
  edits: readonly CodeEdit[]
): Attempt {
  try {
    let text = source;
    const lines = new Map<string, number>();

    // Keyframes first, and one call per element: moving a landing value
    // rewrites the `interpolate()` inside a prop and leaves the JSX structure —
    // and therefore every node path — exactly where it was.
    for (const edit of edits) {
      if (edit.keyframes.length === 0) {
        continue;
      }

      const moved = codemods.updateSequenceKeyframesAst({
        input: text,
        nodePath: edit.nodePath.nodePath,
        schema: edit.schema,
        updates: edit.keyframes.map((keyframe) => ({
          key: keyframe.key,
          operation: {
            frame: keyframe.frame,
            type: "add" as const,
            value: keyframe.value,
          },
        })),
        videoConfigValues: edit.nodePath.videoConfigValues,
      });

      text = moved.serialized;
      lines.set(edit.id, moved.logLine);
    }

    const writing = edits.filter((edit) => edit.updates.length > 0);

    if (writing.length > 0) {
      const changed = codemods.updateMultipleSequenceProps({
        changes: writing.map((edit) => ({
          nodePath: edit.nodePath.nodePath,
          schema: edit.schema,
          updates: edit.updates.map((update) => ({
            defaultValue: update.defaultValue,
            key: update.key,
            value: update.value,
          })),
          videoConfigValues: edit.nodePath.videoConfigValues,
        })),
        input: text,
      });

      text = changed.output;

      for (const [at, edit] of writing.entries()) {
        const line = changed.results[at]?.logLine;
        if (line !== undefined) {
          lines.set(edit.id, line);
        }
      }
    }

    return {
      message: "",
      output: text,
      results: edits.map((edit) => ({
        file: edit.file,
        id: edit.id,
        line: lines.get(edit.id) ?? null,
        message: null,
        ok: true,
      })),
    };
  } catch (cause) {
    return { message: errorMessage(cause), output: null, results: [] };
  }
}

async function contentsOf(
  files: readonly string[],
  read: (file: string) => Promise<string>
): Promise<Map<string, string | Error>> {
  const entries = await Promise.all(
    files.map(async (file): Promise<[string, string | Error]> => {
      try {
        return [file, await read(file)];
      } catch (cause) {
        return [file, new Error(errorMessage(cause))];
      }
    })
  );

  return new Map(entries);
}

export interface Removal {
  readonly after: string;
  readonly before: string;
  readonly file: string;
  readonly line: number | null;
}

export const CANNOT_DELETE =
  "This project's Remotion cannot delete elements from the code. Update Remotion in this project to delete here.";

export const AMBIGUOUS_LINE =
  "The studio cannot delete this: its line in the code starts more than one element, so it cannot tell which one you picked.";

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lineStart(text: string, line: number): number {
  let offset = 0;
  for (let at = 1; at < line; at += 1) {
    const next = text.indexOf("\n", offset);
    if (next === -1) {
      return -1;
    }
    offset = next + 1;
  }
  return offset;
}

function tagOffset(
  text: string,
  line: number,
  component: string
): number | null {
  const start = lineStart(text, line);
  if (start === -1) {
    return null;
  }
  const end = text.indexOf("\n", start);
  const row = text.slice(start, end === -1 ? text.length : end);
  const found = [
    ...row.matchAll(new RegExp(`<${escaped(component)}(?![\\w$.])`, "g")),
  ];
  return found.length === 1 ? start + (found[0].index ?? 0) : null;
}

function sharedPrefix(before: string, after: string, limit: number): number {
  let length = 0;
  while (length < limit && before[length] === after[length]) {
    length += 1;
  }
  return length;
}

function sharedSuffix(before: string, after: string, limit: number): number {
  let length = 0;
  while (length < limit && before.at(-1 - length) === after.at(-1 - length)) {
    length += 1;
  }
  return length;
}

// Where the removed text starts is ambiguous when it sits among repeated
// text — `<Badge />` above `<Footer />` share their indent and `<`. Every
// alignment starts between the left-most (suffix matched first) and the
// right-most (prefix matched first); the picked tag has to be one of them.
function removedFrom(before: string, after: string, offset: number): boolean {
  const right = sharedPrefix(before, after, after.length);
  const end = before.length - sharedSuffix(before, after, after.length - right);
  const tail = sharedSuffix(before, after, after.length);
  const left = sharedPrefix(before, after, after.length - tail);
  if (offset < left || offset >= end) {
    return false;
  }
  return offset <= right || before.slice(right, offset).trim().length === 0;
}

export function removalOf(
  codemods: Codemods,
  component: string,
  target: CodeTarget,
  video: VideoConfigValues,
  read: (file: string) => Promise<string> = (file) => readFile(file, "utf8")
): Effect.Effect<Removal, PreviewError> {
  return Effect.tryPromise({
    catch: (cause) =>
      cause instanceof PreviewError
        ? cause
        : new PreviewError({ message: errorMessage(cause) }),
    try: async () => {
      const refuse = (message: string) => new PreviewError({ message });
      if (!isTypeScriptFile(target.file)) {
        throw refuse(`The studio cannot delete this: ${NOT_TYPESCRIPT}.`);
      }
      const remove = codemods.deleteJsxNode;
      if (remove === undefined) {
        throw refuse(CANNOT_DELETE);
      }
      const before = await read(target.file);
      const found = codemods.computeSequencePropsSubscriptionFromContent({
        absolutePath: target.file,
        assetKeys: [],
        componentIdentity: target.identity,
        effects: [],
        fileContents: before,
        keys: [...target.keys],
        line: target.line,
        preferredNodePath: null,
        videoConfigValues: video,
      });
      if (!found.success) {
        throw refuse(
          `The studio cannot delete this: ${NO_CALL_SITE}. Pick it again and retry.`
        );
      }
      const offset = tagOffset(before, target.line, component);
      if (offset === null) {
        throw refuse(AMBIGUOUS_LINE);
      }
      const removed = await remove({
        input: before,
        nodePath: found.nodePath.nodePath,
      });
      if (!removedFrom(before, removed.output, offset)) {
        throw refuse(AMBIGUOUS_LINE);
      }
      if (removed.output === before) {
        throw refuse(
          `The studio cannot delete this: ${NO_CALL_SITE}. Pick it again and retry.`
        );
      }
      return {
        after: removed.output,
        before,
        file: target.file,
        line: removed.logLine,
      };
    },
  });
}
