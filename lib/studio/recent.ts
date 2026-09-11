export const RECENT_LIMIT = 8;

export function pushRecent(
  ring: readonly string[],
  id: string,
  limit: number = RECENT_LIMIT
): readonly string[] {
  return [id, ...ring.filter((entry) => entry !== id)].slice(0, limit);
}
