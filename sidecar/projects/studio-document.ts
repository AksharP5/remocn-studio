import { readFile } from "node:fs/promises";
import { Data, Effect, Schema } from "effect";
import { errorMessage } from "@/lib/error-message";
import {
  applyStudioOperation,
  StudioDocument,
  type StudioOperation,
  type StudioSnapshot,
} from "@/shared/studio-document";
import { remotionRootOf } from "../preview/project";
import {
  atomicJson,
  contained,
  hashBytes,
  serialized,
  withConfigLock,
} from "./config";

export class StudioDocumentError extends Data.TaggedError(
  "StudioDocumentError"
)<{
  message: string;
}> {}

const decode = Schema.decodeUnknownEffect(StudioDocument);
const SLUG = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

function documentPath(video: string): string {
  if (!SLUG.test(video)) {
    throw new StudioDocumentError({
      message: "Choose a Studio video before editing its properties.",
    });
  }
  return `src/videos/${video}/studio.json`;
}

function attempt<A>(work: () => Promise<A>) {
  return Effect.tryPromise({
    catch: (cause) => new StudioDocumentError({ message: errorMessage(cause) }),
    try: work,
  });
}

function read(root: string, video: string) {
  return Effect.gen(function* () {
    const text = yield* attempt(async () => {
      const path = await contained(root, documentPath(video));
      return readFile(path, "utf8");
    });
    const raw = yield* Effect.try({
      catch: () =>
        new StudioDocumentError({
          message:
            "The object's document is not valid JSON. Finish or repair the file before editing.",
        }),
      try: () => JSON.parse(text) as unknown,
    });
    const document = yield* decode(raw, { onExcessProperty: "error" }).pipe(
      Effect.mapError(
        (cause) =>
          new StudioDocumentError({
            message: `This video's editable document is invalid or uses an unsupported format: ${cause.message}`,
          })
      )
    );
    if (document.video !== video) {
      return yield* Effect.fail(
        new StudioDocumentError({
          message: "This object document belongs to a different video.",
        })
      );
    }
    return { document, revision: hashBytes(text), text };
  });
}

export function readStudioDocument(folder: string, video: string) {
  return read(remotionRootOf(folder), video).pipe(
    Effect.map(
      ({ document, revision }): StudioSnapshot => ({ document, revision })
    )
  );
}

export function writeStudioDocument(
  folder: string,
  video: string,
  operation: StudioOperation
) {
  const root = remotionRootOf(folder);
  return attempt(() =>
    serialized(root, () =>
      withConfigLock(root, async () => {
        const current = await Effect.runPromise(read(root, video));
        const next = applyStudioOperation(current.document, operation);
        if (next === current.document) {
          return { document: current.document, revision: current.revision };
        }
        await Effect.runPromise(decode(next));
        const path = documentPath(video);
        const now = await readFile(await contained(root, path), "utf8");
        if (now !== current.text) {
          throw new StudioDocumentError({
            message:
              "The video changed while saving. Reload the properties and try again.",
          });
        }
        await atomicJson(root, path, next);
        const saved = `${JSON.stringify(next, null, 2)}\n`;
        return { document: next, revision: hashBytes(saved) };
      })
    )
  );
}
