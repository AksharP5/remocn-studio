import type { PromptElement, TuningChange, TuningOwner } from "@/shared/ipc";
import { referenceOf, segmentsOf } from "@/shared/references";

const MARKUP_LIMIT = 2000;

export type PromptPart =
  | { index: number; kind: "image" }
  | { kind: "text"; text: string };

export function elementsOf(elements: readonly PromptElement[]): string | null {
  if (elements.length === 0) {
    return null;
  }

  const blocks = elements.map((element, index) => describe(element, index));

  return `The elements referenced above, each picked in the running preview:\n\n${blocks.join("\n\n")}`;
}

function describe(element: PromptElement, index: number): string {
  const lines = [
    referenceOf("element", index),
    `file: ${where(element)}`,
    `component: ${element.component ?? "unknown"}`,
    `composition: ${element.composition}, frame ${element.frame}`,
  ];

  if (element.scene !== null) {
    const { durationInFrames, frame, from, name } = element.scene;
    const called = name.length > 0 ? `${name}, ` : "";
    lines.push(
      `scene: ${called}from frame ${from} for ${durationInFrames} frames, at frame ${frame} within it`
    );
  }

  if (element.stack.length > 0) {
    lines.push(`rendered through: ${element.stack.join(" ← ")}`);
  }

  lines.push(
    ...changeLines(
      element.tuningChanges ?? [],
      element.frame,
      element.written === true
    )
  );

  lines.push(`markup: ${truncate(element.html)}`);

  return lines.join("\n");
}

function changeLines(
  changes: readonly TuningChange[],
  frame: number,
  written: boolean
): string[] {
  const grouped = new Map<string, string[]>();

  for (const change of changes) {
    const heading = headingFor(change.owner, written);
    const rows = grouped.get(heading) ?? [];

    rows.push(
      `- ${change.path}: ${JSON.stringify(change.from)}${sampledNote(change, frame)} → ${JSON.stringify(change.to)}`
    );
    grouped.set(heading, rows);
  }

  return Array.from(grouped, ([heading, rows]) => [heading, ...rows]).flat();
}

function sampledNote(change: TuningChange, frame: number): string {
  return change.sampled === true
    ? ` (runtime value at frame ${frame}, animated in code; change the landing value, not the frame)`
    : "";
}

// Two headings, one shape. A written change is a fact the agent has to know
// and must not act on: the studio already rewrote that call site, and asking
// for it a second time would land the same edit twice.
function headingFor(owner: TuningOwner | undefined, written: boolean): string {
  const asked = written ? "Already written by the studio" : "Requested changes";
  const done = written
    ? " These are in the file already — leave them exactly as they are."
    : "";

  if (owner === undefined) {
    return `${asked}:${done}`;
  }

  const called =
    owner.name === null || owner.name.length === 0 ? "" : ` ‹${owner.name}›`;

  return `${asked} on ${owner.component}${called}${locationOf(owner)}:${done}`;
}

function locationOf(owner: TuningOwner): string {
  if (owner.file === null) {
    return "";
  }

  return owner.line === null
    ? ` (${owner.file})`
    : ` (${owner.file}:${owner.line})`;
}

function where(element: PromptElement): string {
  if (element.file === null) {
    return "unresolved — no source location for this element";
  }

  return [element.file, element.line, element.column]
    .filter((part) => part !== null)
    .join(":");
}

function truncate(html: string): string {
  return html.length <= MARKUP_LIMIT ? html : `${html.slice(0, MARKUP_LIMIT)}…`;
}

export function partsOf(
  prompt: string,
  images: number,
  others: { asset: number; element: number }
): PromptPart[] {
  const spliced: PromptPart[] = [];
  const referenced = new Set<number>();
  let buffer = "";

  const flush = () => {
    if (buffer.length > 0) {
      spliced.push({ kind: "text", text: buffer });
      buffer = "";
    }
  };

  for (const segment of segmentsOf(prompt, {
    asset: others.asset,
    element: others.element,
    image: images,
  })) {
    const spliceable =
      segment.kind === "reference" &&
      segment.reference === "image" &&
      !referenced.has(segment.index);

    if (!spliceable) {
      buffer += segment.text;
      continue;
    }

    flush();
    referenced.add(segment.index);
    spliced.push({ index: segment.index, kind: "image" });
  }

  flush();

  const unreferenced = Array.from({ length: images }, (_, index) => index)
    .filter((index) => !referenced.has(index))
    .map((index): PromptPart => ({ index, kind: "image" }));

  return [...unreferenced, ...trimEdges(spliced)].filter(
    (part) => part.kind === "image" || part.text.trim().length > 0
  );
}

function trimEdges(parts: PromptPart[]): PromptPart[] {
  const last = parts.length - 1;

  return parts.map((part, at) => {
    if (part.kind === "image") {
      return part;
    }

    const started = at === 0 ? part.text.trimStart() : part.text;
    return { kind: "text", text: at === last ? started.trimEnd() : started };
  });
}
