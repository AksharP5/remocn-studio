export const STRIP_COLUMNS = 15;
export const STRIP_ROWS = 5;
export const STRIP_RINGS = 6;

export interface StripDot {
  readonly id: string;
  readonly parity: number;
  readonly ring: number;
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
      id: `${row}-${column}`,
      parity: Math.round(distance) % 2,
      ring: farthest === 0 ? 0 : (distance / farthest) * STRIP_RINGS,
    };
  });
}
