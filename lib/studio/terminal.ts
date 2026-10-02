import { invoke } from "@tauri-apps/api/core";
import { Data, Effect } from "effect";
import { errorMessage } from "@/lib/error-message";

export class TerminalError extends Data.TaggedError("TerminalError")<{
  message: string;
}> {}

const fail = (cause: unknown) =>
  new TerminalError({ message: errorMessage(cause) });

const TRAILING_SLASH = /\/+$/;

export function linuxSetupCommand(command: string, dataDir: string): string {
  const bin = `${dataDir.replace(TRAILING_SLASH, "")}/node/bin`;
  const quoted = `'${bin.replaceAll("'", "'\\''")}'`;
  return `export PATH=${quoted}:"$PATH"; ${command}`;
}

export function copyCommand(
  command: string
): Effect.Effect<void, TerminalError> {
  return Effect.tryPromise({
    catch: fail,
    try: () => navigator.clipboard.writeText(command),
  });
}

export function openTerminalWith(
  command: string
): Effect.Effect<void, TerminalError> {
  return copyCommand(command).pipe(
    Effect.andThen(
      Effect.tryPromise({
        catch: fail,
        try: () => invoke<void>("open_terminal"),
      })
    )
  );
}
