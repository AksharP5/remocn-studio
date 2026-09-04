import { Effect } from "effect";
import {
  newRequestId,
  requestSidecar,
  type SidecarError,
} from "@/lib/studio/sidecar";
import type { StockProgress, StockQuery } from "@/shared/ipc";
import type { Asset, StockItem, StockPage } from "@/shared/library";

export function searchStock(
  query: StockQuery
): Effect.Effect<StockPage, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "library.stockSearch",
      params: query,
    });
  });
}

export function saveStock(
  item: StockItem,
  onProgress: (progress: StockProgress) => void
): Effect.Effect<Asset, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "library.stockSave",
      onStream: onProgress,
      params: item,
    });
  });
}

export const stockStatus: Effect.Effect<boolean, SidecarError> = Effect.gen(
  function* () {
    const id = yield* newRequestId;

    const answer = yield* requestSidecar({
      id,
      method: "library.stockStatus",
      params: null,
    });

    return answer.configured;
  }
);

export function setStockKey(
  key: string | null
): Effect.Effect<boolean, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    const answer = yield* requestSidecar({
      id,
      method: "library.stockKey",
      params: { key },
    });

    return answer.configured;
  });
}

// Pexels' alt text is a sentence, and a sentence is not a name. The library
// grid is two columns in a 288px sidebar — about twelve characters a label —
// so every stock photo read `Dynamic wa…`, `A serene vi…`, `Close up of…`:
// the descriptive prefix alt text always opens with, which is exactly the part
// that does not tell one photo from another. It is also already truncated at
// the source, so what landed in `manifest.json` was a fragment stopping
// mid-clause.
//
// What identifies a saved asset is what you searched for and who took it. The
// alt text is kept where prose belongs — the card's own title, and the search
// result it came from.
const NAME_LIMIT = 48;

export function stockName(query: string, item: StockItem): string {
  const asked = query.trim().replace(/\s+/g, " ");
  const author = item.author.trim();

  if (asked.length === 0) {
    return author.length === 0 ? item.name : `${labelOf(item)} by ${author}`;
  }

  const named = author.length === 0 ? asked : `${asked} — ${author}`;

  return named.length > NAME_LIMIT ? asked.slice(0, NAME_LIMIT).trim() : named;
}

function labelOf(item: StockItem): string {
  return item.kind === "photo" ? "Photo" : "Video";
}
