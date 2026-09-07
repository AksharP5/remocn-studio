import type { TuningTarget } from "@/lib/studio/preview";
import { routeOf } from "@/shared/codemod";
import type {
  CodeEdit,
  CodeKeyframeUpdate,
  CodePropUpdate,
  CodeStatusKind,
  CodeTarget,
  CodeTargetStatus,
  CodeWritten,
  TuningChange,
  TuningOwner,
  TuningValue,
} from "@/shared/ipc";

export const TEXT_PATH = "children";

/** A field the pane is holding a new value for, with where it came from. */
export interface Changed {
  readonly from: TuningValue;
  readonly path: string;
  readonly target: TuningTarget;
  readonly to: TuningValue;
  readonly type: string;
}

export interface WritePlan {
  /** What the agent is asked to do, with the reason each one is its job. */
  readonly agent: readonly TuningChange[];
  /** What the studio wrote itself, told to the agent so it leaves them alone. */
  readonly code: readonly TuningChange[];
  readonly edits: readonly CodeEdit[];
}

const EMPTY: WritePlan = { agent: [], code: [], edits: [] };

export function emptyPlan(): WritePlan {
  return EMPTY;
}

/**
 * Which targets a status can be asked for.
 *
 * Two things have to be true: Remotion recorded a call site for the element —
 * it does that in `development`, off `jsxDEV`'s source argument — and the
 * schema has keys to ask about. Anything else is a target the studio can show
 * and cannot write.
 */
export function statusTargetsOf(
  targets: readonly TuningTarget[]
): CodeTarget[] {
  return targets.flatMap((target) => {
    const line = target.origin?.line ?? null;
    const file = target.origin?.file ?? null;

    if (line === null || file === null || target.keys.length === 0) {
      return [];
    }

    return [
      {
        file,
        id: target.targetId,
        identity: target.identity,
        keys: [...target.keys],
        line,
      },
    ];
  });
}

export function kindOf(
  statuses: Readonly<Record<string, CodeTargetStatus>>,
  targetId: string,
  path: string
): CodeStatusKind | null {
  return statuses[targetId]?.props[path]?.kind ?? null;
}

export function isWritable(
  statuses: Readonly<Record<string, CodeTargetStatus>>,
  targetId: string
): boolean {
  return (statuses[targetId]?.nodePath ?? null) !== null;
}

/**
 * The split one Add makes: what the studio writes, and what it asks for.
 *
 * The routing is `shared/codemod.ts`'s, so the pane, the chips and the prompt
 * cannot disagree about which half a change is in.
 */
export function planWrites(input: {
  readonly changed: readonly Changed[];
  readonly fonts: readonly string[];
  readonly frames: Readonly<Record<string, number>>;
  readonly statuses: Readonly<Record<string, CodeTargetStatus>>;
}): WritePlan {
  const agent: TuningChange[] = [];
  const code: TuningChange[] = [];
  const updates = new Map<string, CodePropUpdate[]>();
  const keyframes = new Map<string, CodeKeyframeUpdate[]>();

  for (const change of input.changed) {
    const { path, target } = change;
    const kind = kindOf(input.statuses, target.targetId, path);
    const routed = routeOf({
      file: target.origin?.file ?? null,
      fonts: input.fonts,
      kind,
      type: change.type,
      value: change.to,
      writable: isWritable(input.statuses, target.targetId),
    });

    const entry: TuningChange = {
      from: change.from,
      owner: ownerOf(target),
      path,
      to: change.to,
    };

    if (routed.route === "agent") {
      // A keyframed value the studio cannot write is still a runtime sample:
      // the agent has to be told to move the landing value rather than pin the
      // frame, which is what `sampled` says in the prompt.
      agent.push(kind === "keyframed" ? { ...entry, sampled: true } : entry);
      continue;
    }

    code.push(entry);

    if (kind === "keyframed") {
      push(keyframes, target.targetId, {
        frame: input.frames[frameKey(target.targetId, path)] ?? 0,
        key: path,
        value: change.to,
      });
      continue;
    }

    push(updates, target.targetId, {
      defaultValue: defaultOf(target.schema, path),
      key: path,
      value: change.to,
    });
  }

  const edits = [...new Set([...updates.keys(), ...keyframes.keys()])].flatMap(
    (targetId): CodeEdit[] => {
      const nodePath = input.statuses[targetId]?.nodePath ?? null;
      const target = input.changed.find(
        (change) => change.target.targetId === targetId
      )?.target;

      if (nodePath === null || target === undefined) {
        return [];
      }

      return [
        {
          file: nodePath.absolutePath,
          id: targetId,
          keyframes: keyframes.get(targetId) ?? [],
          nodePath,
          schema: target.schema ?? {},
          updates: updates.get(targetId) ?? [],
        },
      ];
    }
  );

  return { agent, code, edits };
}

export function frameKey(targetId: string, path: string): string {
  return `${targetId}\u0000${path}`;
}

/** The reason a change is the agent's, for the chip's tooltip and the prompt. */
export function reasonFor(input: {
  readonly fonts: readonly string[];
  readonly kind: CodeStatusKind | null;
  readonly target: TuningTarget;
  readonly type: string;
  readonly value: TuningValue;
  readonly writable: boolean;
}): string | null {
  return routeOf({
    file: input.target.origin?.file ?? null,
    fonts: input.fonts,
    kind: input.kind,
    type: input.type,
    value: input.value,
    writable: input.writable,
  }).reason;
}

// A NUL, because a target id is an anchor and may hold anything a CSS
// selector may. It is the same separator `useInspect` keys its drafts by.
const SEPARATOR = "\u0000";

/**
 * Every selection's edits under one id space, so a failed edit names the chip
 * it belongs to. The index rather than the selection's own id, because a
 * selection is addressed by its position everywhere else in the composer.
 */
export function editsOf(
  selections: readonly { readonly writes: readonly CodeEdit[] }[]
): CodeEdit[] {
  return selections.flatMap((selection, index) =>
    selection.writes.map((edit) => ({
      ...edit,
      id: `${index}${SEPARATOR}${edit.id}`,
    }))
  );
}

export function selectionOf(id: string): number | null {
  const [index] = id.split(SEPARATOR);
  const at = Number(index);

  return Number.isInteger(at) && at >= 0 ? at : null;
}

/** Which selections could not be written, and why, keyed by their index. */
export function failuresOf(
  results: readonly CodeWritten[]
): Map<number, string> {
  const failed = new Map<number, string>();

  for (const result of results) {
    const index = selectionOf(result.id);

    if (result.ok || index === null || failed.has(index)) {
      continue;
    }

    failed.set(index, result.message ?? "the studio could not write it");
  }

  return failed;
}

export function writtenFiles(
  results: readonly CodeWritten[]
): { file: string; line: number | null }[] {
  const seen = new Set<string>();
  const files: { file: string; line: number | null }[] = [];

  for (const result of results) {
    const at =
      result.line === null ? result.file : `${result.file}:${result.line}`;

    if (result.ok && !seen.has(at)) {
      seen.add(at);
      files.push({ file: result.file, line: result.line });
    }
  }

  return files;
}

function ownerOf(target: TuningTarget): TuningOwner {
  return {
    component: target.componentName,
    file: target.origin?.file ?? target.where?.file ?? null,
    line: target.origin?.line ?? target.where?.line ?? null,
    name: target.name,
  };
}

function push<A>(into: Map<string, A[]>, key: string, value: A): void {
  const held = into.get(key);

  if (held === undefined) {
    into.set(key, [value]);
    return;
  }

  held.push(value);
}

interface SchemaField {
  readonly default?: unknown;
  readonly type?: string;
  readonly variants?: unknown;
}

/**
 * A key's declared default, so writing that exact value takes the attribute
 * back off the call site. Enum variants nest, exactly as they do for the pane's
 * own flattening, so the walk has to go through them.
 */
export function defaultOf(schema: unknown, path: string): unknown {
  return fieldIn(schema, path)?.default ?? null;
}

function fieldIn(schema: unknown, key: string): SchemaField | null {
  if (schema === null || typeof schema !== "object") {
    return null;
  }

  const table = schema as Record<string, SchemaField>;
  const direct = table[key];

  if (direct !== undefined) {
    return direct;
  }

  for (const field of Object.values(table)) {
    const { variants } = field;

    if (
      field.type !== "enum" ||
      variants === null ||
      typeof variants !== "object" ||
      Array.isArray(variants)
    ) {
      continue;
    }

    for (const variant of Object.values(variants as Record<string, unknown>)) {
      const nested = fieldIn(variant, key);

      if (nested !== null) {
        return nested;
      }
    }
  }

  return null;
}
