import type { PlanOptions } from "./plans";
import {
  type Beat,
  groupWindow,
  readingSeconds,
  type Timeline,
} from "./timing";

export interface DetailsPlan extends Timeline {
  readonly details: readonly { readonly text: string; readonly beat: Beat }[];
  readonly group: Beat;
  readonly heading: Beat;
  readonly kind: "details";
  readonly title: string;
}

/** The whole group finishes arriving before its shared reading interval begins. */
export function detailsPlan(
  title: string,
  details: readonly string[],
  options: PlanOptions = {}
): DetailsPlan {
  if (
    !title.trim() ||
    details.length < 1 ||
    details.length > 8 ||
    details.some((text) => !text.trim())
  ) {
    throw new Error(
      "Details need a heading and 1–8 non-empty items; simplify or split larger groups"
    );
  }
  const headingEntry = options.energy === "brisk" ? 0.42 : 0.64;
  const groupStart = headingEntry + 0.12;
  const settled = groupStart + 0.55;
  const readFor = readingSeconds(details.join(". "), options.reading);
  const exitStart = settled + readFor;
  const end = exitStart + 0.3;
  const heading: Beat = {
    end,
    exitStart,
    id: "heading",
    readFor: readingSeconds(title, options.reading),
    settled: headingEntry,
    start: 0,
  };
  // A long heading gets its own budget without stealing time from its supporting group.
  const extra = Math.max(
    0,
    (heading.readFor ?? 0) - (exitStart - headingEntry)
  );
  const group: Beat = {
    end: end + extra,
    exitStart: exitStart + extra,
    id: "details",
    readFor,
    settled,
    start: groupStart,
  };
  const resolvedHeading = {
    ...heading,
    end: group.end,
    exitStart: group.exitStart,
  };
  const items = details.map((text, index) => {
    const window = groupWindow(groupStart, 0.55, index, details.length);
    return {
      beat: {
        end: group.end,
        exitStart: group.exitStart,
        id: `detail-${index}`,
        parent: group.id,
        settled: window.start + window.duration,
        start: window.start,
      },
      text,
    };
  });
  return {
    beats: [resolvedHeading, group, ...items.map((item) => item.beat)],
    details: items,
    duration: group.end,
    group,
    heading: resolvedHeading,
    kind: "details",
    title,
  };
}

export interface CardContent {
  readonly id: string;
  readonly label: string;
  readonly src: string;
  readonly title: string;
}
export interface CardsPlan extends Timeline {
  readonly cards: readonly {
    readonly content: CardContent;
    readonly beat: Beat;
    readonly caption: Beat;
  }[];
  readonly grid: Beat;
  readonly gridMoveEnd: number;
  readonly kind: "cards";
}

/** Captions exit before the same card objects move into the overview. */
export function cardsPlan(
  cards: readonly CardContent[],
  options: PlanOptions = {}
): CardsPlan {
  if (
    cards.length < 2 ||
    cards.length > 6 ||
    new Set(cards.map((card) => card.id)).size !== cards.length ||
    cards.some(
      (card) =>
        !(
          card.id.trim() &&
          card.title.trim() &&
          card.label.trim() &&
          card.src.trim()
        )
    )
  ) {
    throw new Error(
      "Cards need 2–6 uniquely identified images with a title and short grid label"
    );
  }
  let next = 0;
  const items = cards.map((content) => {
    const settled = next + (options.energy === "brisk" ? 0.42 : 0.64);
    const start = settled + 0.1;
    const readFor = readingSeconds(content.title, options.reading);
    const caption: Beat = {
      end: start + 0.32 + readFor + 0.24,
      exitStart: start + 0.32 + readFor,
      id: `caption:${content.id}`,
      parent: `card:${content.id}`,
      readFor,
      settled: start + 0.32,
      slot: "caption",
      start,
    };
    const beat: Beat = {
      end: caption.end,
      exitStart: caption.end,
      id: `card:${content.id}`,
      settled,
      start: next,
    };
    next = caption.end;
    return { beat, caption, content };
  });
  const readFor = readingSeconds(
    cards.map((card) => card.label).join(". "),
    options.reading
  );
  const gridMoveEnd = next + 0.72;
  const gridEnd = gridMoveEnd + 0.2 + readFor;
  const grid: Beat = {
    end: gridEnd,
    exitStart: gridEnd,
    id: "grid",
    readFor,
    settled: gridMoveEnd + 0.2,
    start: next,
  };
  const resolved = items.map((item) => ({
    ...item,
    beat: { ...item.beat, end: grid.end, exitStart: grid.end },
  }));
  return {
    beats: [...resolved.flatMap((item) => [item.beat, item.caption]), grid],
    cards: resolved,
    duration: grid.end,
    grid,
    gridMoveEnd,
    kind: "cards",
  };
}
