export interface ScrollBox {
  readonly clientWidth: number;
  readonly scrollLeft: number;
  readonly scrollWidth: number;
}

/**
 * Where a wheel should leave a horizontal strip, or `null` when it should not
 * touch it at all.
 *
 * A strip that cannot move — it does not overflow, or it is already against
 * the end the wheel is pushing towards — hands the gesture back, so the wheel
 * keeps belonging to whatever is scrolling underneath it rather than being
 * swallowed by a row two chips wide.
 */
export function wheelScroll(box: ScrollBox, delta: number): number | null {
  const furthest = box.scrollWidth - box.clientWidth;

  if (furthest <= 0 || delta === 0) {
    return null;
  }

  const next = Math.min(furthest, Math.max(0, box.scrollLeft + delta));

  return next === box.scrollLeft ? null : next;
}

// A wheel reports pixels, lines or pages; only the first needs no conversion.
const LINE_HEIGHT = 16;
const PAGE_HEIGHT = 100;

export function wheelDelta(event: WheelEvent): number {
  const raw =
    Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;

  if (event.deltaMode === 1) {
    return raw * LINE_HEIGHT;
  }

  return event.deltaMode === 2 ? raw * PAGE_HEIGHT : raw;
}
