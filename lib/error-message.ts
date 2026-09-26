import { Cause } from "effect";

export function errorMessage(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }
  if (typeof cause === "string") {
    return cause;
  }
  if (
    typeof cause === "object" &&
    cause !== null &&
    "message" in cause &&
    typeof cause.message === "string" &&
    cause.message.length > 0
  ) {
    return cause.message;
  }
  return JSON.stringify(cause) ?? String(cause);
}

export function causeMessage(cause: Cause.Cause<unknown>): string | null {
  if (Cause.hasInterruptsOnly(cause)) {
    return null;
  }
  return errorMessage(Cause.squash(cause));
}
