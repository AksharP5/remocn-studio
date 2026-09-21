export interface PlaybackPosition {
  frame: number;
  playing: boolean;
}

const KEY = "remocn-preview-playback";

export function playbackPositions(storage: Storage, project: string) {
  const key = `${KEY}:${project}`;
  const positions = new Map<string, PlaybackPosition>();
  try {
    const saved: unknown = JSON.parse(storage.getItem(key) ?? "null");
    storage.removeItem(key);
    if (Array.isArray(saved)) {
      for (const entry of saved) {
        if (
          Array.isArray(entry) &&
          entry.length === 2 &&
          typeof entry[0] === "string" &&
          entry[1] !== null &&
          typeof entry[1] === "object" &&
          Number.isFinite(entry[1].frame) &&
          entry[1].frame >= 0 &&
          typeof entry[1].playing === "boolean"
        ) {
          positions.set(entry[0], entry[1]);
        }
      }
    }
  } catch {
    positions.clear();
  }
  return {
    persist() {
      try {
        storage.setItem(key, JSON.stringify([...positions]));
        return true;
      } catch {
        return false;
      }
    },
    remember(composition: string, position: PlaybackPosition) {
      positions.set(composition, position);
    },
    restore(composition: string, duration: number): PlaybackPosition {
      const position = positions.get(composition);
      return {
        frame: Math.min(
          Math.max(0, duration - 1),
          Math.round(position?.frame ?? 0)
        ),
        playing: position?.playing ?? false,
      };
    },
  };
}
