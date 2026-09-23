import { SCENE_DEFINITION, type StudioObject } from "@/shared/studio-document";

export interface LayerRow {
  ancestors: readonly string[];
  depth: number;
  hasChildren: boolean;
  id: string;
  isScene: boolean;
  label: string;
}

export function layersOf(objects: readonly StudioObject[]): LayerRow[] {
  const known = new Set(objects.map((object) => object.id));
  const children = new Map<string | null, StudioObject[]>();
  for (const object of objects) {
    const parent =
      object.parentId !== null && known.has(object.parentId)
        ? object.parentId
        : null;
    children.set(parent, [...(children.get(parent) ?? []), object]);
  }
  const rows: LayerRow[] = [];
  const visit = (parent: string | null, ancestors: readonly string[]) => {
    for (const object of children.get(parent) ?? []) {
      rows.push({
        ancestors,
        depth: ancestors.length,
        hasChildren: children.has(object.id),
        id: object.id,
        isScene: object.definition === SCENE_DEFINITION,
        label: object.label,
      });
      visit(object.id, [...ancestors, object.id]);
    }
  };
  visit(null, []);
  return rows;
}

export function withAncestors(
  rows: readonly LayerRow[],
  ids: Iterable<string>
): Set<string> {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const found = new Set<string>();
  for (const id of ids) {
    const row = byId.get(id);
    if (row) {
      found.add(id);
      for (const ancestor of row.ancestors) {
        found.add(ancestor);
      }
    }
  }
  return found;
}

export function visibleRows(
  rows: readonly LayerRow[],
  isOpen: (row: LayerRow) => boolean
): LayerRow[] {
  const closed = new Set(
    rows.filter((row) => row.hasChildren && !isOpen(row)).map((row) => row.id)
  );
  return rows.filter((row) =>
    row.ancestors.every((ancestor) => !closed.has(ancestor))
  );
}

export function nextPresent(
  rows: readonly LayerRow[],
  present: ReadonlySet<string>,
  current: string | null,
  step: 1 | -1
): string | null {
  const order = rows.filter((row) => present.has(row.id)).map((row) => row.id);
  if (order.length === 0) {
    return null;
  }
  const at = current === null ? -1 : order.indexOf(current);
  if (at === -1) {
    return step === 1 ? (order[0] ?? null) : (order.at(-1) ?? null);
  }
  return order[(at + step + order.length) % order.length] ?? null;
}
