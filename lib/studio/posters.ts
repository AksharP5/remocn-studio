import { Effect, Semaphore } from "effect";
import { previewUrl } from "@/lib/studio/attachments";
import { firstFrame, ThumbnailError } from "@/lib/studio/thumbnail";

const posters = new Map<string, string>();
const decoding = Semaphore.makeUnsafe(1);

export function knownPoster(path: string): string | null {
  return posters.get(path) ?? null;
}

export function posterOf(
  path: string,
  name: string
): Effect.Effect<string, ThumbnailError> {
  const url = previewUrl(path);

  if (url === null) {
    return Effect.fail(
      new ThumbnailError({ message: `${name} has no readable path.` })
    );
  }

  return decoding.withPermit(
    Effect.suspend(() => {
      const known = posters.get(path);
      if (known !== undefined) {
        return Effect.succeed(known);
      }

      return firstFrame(url, name).pipe(
        Effect.map((still) => {
          const src = URL.createObjectURL(still.file);
          posters.set(path, src);
          return src;
        })
      );
    })
  );
}
