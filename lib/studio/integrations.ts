import { invoke } from "@tauri-apps/api/core";
import { Data, Effect, Exit, Schema } from "effect";
import { errorMessage } from "@/lib/error-message";
import {
  Catalogue,
  Connection,
  ConnectionAttempt,
  ConnectionRemoval,
  Connections,
  type AuthorizationKind,
} from "@/shared/integrations";

export class IntegrationError extends Data.TaggedError("IntegrationError")<{
  message: string;
}> {}

const DECODE_FAILED =
  "The studio answered about your connections in a shape it cannot read.";

const decodeCatalogue = Schema.decodeUnknownExit(Catalogue);
const decodeConnection = Schema.decodeUnknownExit(Connection);
const decodeConnections = Schema.decodeUnknownExit(Connections);
const decodeAttempt = Schema.decodeUnknownExit(ConnectionAttempt);
const decodeRemoval = Schema.decodeUnknownExit(ConnectionRemoval);

function command<A>(
  name: string,
  decode: (data: unknown) => Exit.Exit<A, unknown>,
  args?: Record<string, unknown>
): Effect.Effect<A, IntegrationError> {
  return Effect.tryPromise({
    catch: (cause) => new IntegrationError({ message: errorMessage(cause) }),
    try: () => invoke<unknown>(name, args),
  }).pipe(
    Effect.flatMap((data) =>
      decode(data).pipe(
        Effect.mapError(
          () => new IntegrationError({ message: DECODE_FAILED })
        )
      )
    )
  );
}

const nothing = (): Exit.Exit<void, never> => Exit.void;

export const readCatalogue = command("integrations_catalogue", decodeCatalogue);

export const readConnections = command("integrations_list", decodeConnections);

export function beginConnection(draft: {
  authorization: AuthorizationKind;
  provider: string;
  secret: string | null;
}) {
  return command("integrations_begin", decodeAttempt, { draft });
}

export function confirmConnection(name: string) {
  return command("integrations_confirm", decodeConnection, { name });
}

export const cancelConnection = command("integrations_cancel", nothing);

export function checkConnection(id: string) {
  return command("integrations_check", decodeConnection, { id });
}

export function replaceSecret(id: string, secret: string) {
  return command("integrations_reconfigure", decodeConnection, { id, secret });
}

export function setConnectionDisabled(id: string, disabled: boolean) {
  return command("integrations_set_disabled", decodeConnection, {
    disabled,
    id,
  });
}

export function removeConnection(id: string) {
  return command("integrations_remove", decodeRemoval, { id });
}
