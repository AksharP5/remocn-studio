import { Data, Effect, Exit, Schema, type SchemaError } from "effect";

export const EntitlementDevice = Schema.Struct({
  id: Schema.String,
  lastSeenAt: Schema.String,
  name: Schema.String,
});

export const EntitlementDocument = Schema.Struct({
  devices: Schema.Array(EntitlementDevice),
  expiresAt: Schema.String,
  graceEndsAt: Schema.NullOr(Schema.String),
  issuedAt: Schema.String,
  plan: Schema.Literals(["free", "pro"]),
  trialEndsAt: Schema.NullOr(Schema.String),
  trialStartedAt: Schema.optionalKey(Schema.NullOr(Schema.String)),
});

export type EntitlementDocument = (typeof EntitlementDocument)["Type"];

export const SignedEntitlement = Schema.Struct({
  algorithm: Schema.Literal("ed25519"),
  payload: Schema.String,
  signature: Schema.String,
});

export type SignedEntitlement = (typeof SignedEntitlement)["Type"];

export const decodeSignedEntitlement =
  Schema.decodeUnknownExit(SignedEntitlement);

const decodeDocument = Schema.decodeUnknownExit(EntitlementDocument);

export class EntitlementError extends Data.TaggedError("EntitlementError")<{
  message: string;
}> {}

export function decodeEntitlementPayload(
  payload: string
): Exit.Exit<EntitlementDocument, EntitlementError | SchemaError.SchemaError> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(atob(payload));
  } catch (cause) {
    return Exit.fail(
      new EntitlementError({
        message: `The entitlement payload is not readable: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      })
    );
  }
  return decodeDocument(parsed);
}

export function decodeEntitlement(
  signed: unknown
): Effect.Effect<
  EntitlementDocument,
  EntitlementError | SchemaError.SchemaError
> {
  return decodeSignedEntitlement(signed).pipe(
    Effect.flatMap((envelope) => decodeEntitlementPayload(envelope.payload))
  );
}

export type AccountPlan =
  | { kind: "free"; trialEndedAt: string | null }
  | { kind: "grace"; accessUntil: string }
  | { kind: "pro" }
  | { kind: "trial"; endsAt: string; startedAt: string | null };

export function planAt(
  document: EntitlementDocument,
  now: number
): AccountPlan {
  const trialEnds = timeOf(document.trialEndsAt);
  const graceEnds = timeOf(document.graceEndsAt);

  if (document.plan === "free") {
    return {
      kind: "free",
      trialEndedAt:
        trialEnds !== null && trialEnds <= now ? document.trialEndsAt : null,
    };
  }
  if (graceEnds !== null && graceEnds > now && document.graceEndsAt !== null) {
    return { accessUntil: document.graceEndsAt, kind: "grace" };
  }
  if (trialEnds !== null && trialEnds > now && document.trialEndsAt !== null) {
    return {
      endsAt: document.trialEndsAt,
      kind: "trial",
      startedAt: document.trialStartedAt ?? null,
    };
  }
  return { kind: "pro" };
}

export function isProPlan(plan: AccountPlan): boolean {
  return plan.kind !== "free";
}

function timeOf(iso: string | null): number | null {
  if (iso === null) {
    return null;
  }
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : time;
}
