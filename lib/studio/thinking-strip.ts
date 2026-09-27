export const STRIP_COLUMNS = 15;
export const STRIP_ROWS = 5;
export const STRIP_RINGS = 6;

const PRISM: readonly (readonly [number, readonly [number, number, number]])[] =
  [
    [0, [0x12, 0xc2, 0xe9]],
    [0.45, [0xc4, 0x71, 0xed]],
    [1, [0xf6, 0x4f, 0x59]],
  ];

export interface StripDot {
  readonly color: string;
  readonly id: string;
  readonly parity: number;
  readonly ring: number;
}

export function prismAt(position: number): string {
  const at = Math.min(1, Math.max(0, position));
  const upper = PRISM.findIndex(([stop]) => stop >= at);
  const [end, to] = PRISM[Math.max(1, upper)] ?? PRISM[1];
  const [start, from] = PRISM[Math.max(0, upper - 1)] ?? PRISM[0];
  const share = end === start ? 0 : (at - start) / (end - start);
  const [r, g, b] = from.map((channel, index) =>
    Math.round(channel + ((to[index] ?? channel) - channel) * share)
  );
  return `rgb(${r} ${g} ${b})`;
}

export function stripDots(
  columns = STRIP_COLUMNS,
  rows = STRIP_ROWS
): StripDot[] {
  const middleColumn = (columns - 1) / 2;
  const middleRow = (rows - 1) / 2;
  const farthest = middleColumn + middleRow;
  return Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const distance =
      Math.abs(column - middleColumn) + Math.abs(row - middleRow);
    return {
      color: prismAt(columns === 1 ? 0 : column / (columns - 1)),
      id: `${row}-${column}`,
      parity: Math.round(distance) % 2,
      ring: farthest === 0 ? 0 : (distance / farthest) * STRIP_RINGS,
    };
  });
}
