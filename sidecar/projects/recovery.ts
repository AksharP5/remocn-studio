import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Schema } from "effect";
import { DATA_DIR_ENV } from "@/shared/ipc";
import { readManifest } from "./config";

const decode = Schema.decodeUnknownSync(
  Schema.Struct({
    destination: Schema.String,
    phase: Schema.Literals(["prepared", "files-moved", "switched"]),
    projectId: Schema.String,
    source: Schema.String,
  })
);

export async function recoveredLocation(
  id: string,
  source: string
): Promise<string | null> {
  let journal: ReturnType<typeof decode>;
  try {
    journal = decode(
      JSON.parse(
        await readFile(
          join(
            process.env[DATA_DIR_ENV] ?? join(tmpdir(), "remocn-studio"),
            "moves",
            `${id}.json`
          ),
          "utf8"
        )
      )
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
  if (journal.projectId !== id || journal.source !== source) {
    return null;
  }
  const destination = await readManifest(journal.destination);
  if (destination?.projectId !== id) {
    return null;
  }
  return journal.destination;
}
