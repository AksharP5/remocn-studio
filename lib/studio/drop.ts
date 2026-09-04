import type { PromptMedia } from "@/shared/ipc";
import { mediaOf, unsendableImageOf } from "./attachments";

export interface DropPoint {
  readonly x: number;
  readonly y: number;
}

export interface DropBox {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

// The point arrives in CSS pixels already, so there is nothing to convert.
// Tauri types it as a `PhysicalPosition` the whole way up, and that is what the
// old scaling here believed — but on macOS wry builds it from AppKit:
// `draggingLocation()` against the view's own `frame()`, both of which are in
// *points* (wry 0.55.1, `src/wkwebview/drag_drop.rs`). Points are CSS pixels,
// which is also what `getBoundingClientRect()` returns, so dividing by the
// device ratio moved every drop up and to the left — far enough on a 2× display
// to push a point in the middle of the composer into the sidebar, where it was
// silently filed in the library instead.
export function isInside(
  box: DropBox | null,
  point: DropPoint | null
): boolean {
  if (box === null || point === null) {
    return false;
  }

  return (
    point.x >= box.left &&
    point.x <= box.right &&
    point.y >= box.top &&
    point.y <= box.bottom
  );
}

export interface DropZone<Name extends string = string> {
  readonly box: DropBox | null;
  readonly name: Name;
}

export function zoneAt<Name extends string>(
  zones: readonly DropZone<Name>[],
  point: DropPoint | null
): Name | null {
  const found = zones.find((zone) => isInside(zone.box, point));

  return found?.name ?? null;
}

export interface MediaDrop {
  readonly kept: PromptMedia[];
  readonly skipped: string[];
}

export function mediaDrop(paths: readonly string[]): MediaDrop {
  const kept: PromptMedia[] = [];
  const skipped: string[] = [];

  for (const path of paths) {
    const found = mediaOf(path);
    if (found === null) {
      skipped.push(path);
      continue;
    }
    kept.push(found);
  }

  return { kept, skipped };
}

// Two refusals, because they have different answers. A file the studio does not
// recognise at all is one thing; a photograph in a format the model cannot read
// is another, and that one has a way out worth saying.
export function refusalOf(
  skipped: readonly string[],
  destination: string
): string | null {
  if (skipped.length === 0) {
    return null;
  }

  const formats = [
    ...new Set(skipped.flatMap((path) => unsendableImageOf(path) ?? [])),
  ];
  const unknown = skipped.filter((path) => unsendableImageOf(path) === null);

  const sentences = [
    picturesRefusal(formats, skipped.length - unknown.length),
    unknownRefusal(unknown.length, destination),
  ].filter((sentence) => sentence !== null);

  return sentences.length === 0 ? null : sentences.join(" ");
}

function picturesRefusal(
  formats: readonly string[],
  count: number
): string | null {
  if (count === 0) {
    return null;
  }

  const named = formats.join(", ");

  return count === 1
    ? `${named} is not a picture the model can read, so it was left out — export it as JPEG or PNG.`
    : `${count} of those (${named}) are not pictures the model can read, so they were left out — export them as JPEG or PNG.`;
}

function unknownRefusal(count: number, destination: string): string | null {
  if (count === 0) {
    return null;
  }

  return count === 1
    ? `That is not a picture, a video or a sound, so it did not go into ${destination}.`
    : `${count} of those are not pictures, video or sound, so they did not go into ${destination}.`;
}
