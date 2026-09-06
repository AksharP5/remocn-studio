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

// What a turn is allowed to do, as the sidecar hears it: the four states the
// account page distinguishes collapse to this one bit at the seam.
export const PlanTier = Schema.Literals(["free", "pro"]);

export type PlanTier = (typeof PlanTier)["Type"];

// The raw 32-byte Ed25519 public key whose private half signs every document
// the account server issues. Rotating the server's key invalidates every
// document an app is holding, so it changes here in the same release.
export const ENTITLEMENT_PUBLIC_KEY =
  "i0ye9vhepisf1dV0Veie5PO8a6QI5fqVNx/JuftIFtQ=";

export const ENTITLEMENT_ALGORITHM = "Ed25519";

// What Pro is, in one list, so a test can pin that every entry is gated in
// exactly one place and that a Free turn carries none of them.
export const PRO_FEATURES = [
  "skills-bundle",
  "pipeline-tools",
  "craft-conventions",
  "inspect",
  "snapshot",
] as const;

export type ProFeature = (typeof PRO_FEATURES)[number];

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

function bytesOf(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

const NOT_GENUINE =
  "The entitlement document is not signed by the account server.";

// One Ed25519 verify over the payload's own ASCII bytes — the bytes on the
// wire are the bytes that were signed, so there is no canonical JSON to agree
// on. A signature that does not check is a failure, never a document.
export function verifyEntitlement(
  signed: unknown,
  publicKey: string
): Effect.Effect<
  EntitlementDocument,
  EntitlementError | SchemaError.SchemaError
> {
  return decodeSignedEntitlement(signed).pipe(
    Effect.flatMap((envelope) =>
      Effect.tryPromise({
        catch: (cause) =>
          new EntitlementError({
            message: `The entitlement signature could not be checked: ${
              cause instanceof Error ? cause.message : String(cause)
            }`,
          }),
        try: async () => {
          const key = await crypto.subtle.importKey(
            "raw",
            bytesOf(publicKey),
            { name: ENTITLEMENT_ALGORITHM },
            false,
            ["verify"]
          );
          return crypto.subtle.verify(
            { name: ENTITLEMENT_ALGORITHM },
            key,
            bytesOf(envelope.signature),
            new TextEncoder().encode(envelope.payload)
          );
        },
      }).pipe(
        Effect.flatMap((genuine) =>
          genuine
            ? decodeEntitlementPayload(envelope.payload)
            : Effect.fail(new EntitlementError({ message: NOT_GENUINE }))
        )
      )
    )
  );
}

export type AccountPlan =
  | { kind: "free"; trialEndedAt: string | null; unverified: boolean }
  | { kind: "grace"; accessUntil: string }
  | { kind: "pro" }
  | { kind: "trial"; endsAt: string; startedAt: string | null };

export function isEntitlementExpired(
  document: EntitlementDocument,
  now: number
): boolean {
  const expires = timeOf(document.expiresAt);
  return expires === null || expires <= now;
}

// A document past its own `expiresAt` vouches for nothing: the app has been
// unable to refresh it for the document's whole lifetime, so the plan is Free
// and the person is told the subscription could not be checked, rather than
// being quietly downgraded.
export function planAt(
  document: EntitlementDocument,
  now: number
): AccountPlan {
  const trialEnds = timeOf(document.trialEndsAt);
  const graceEnds = timeOf(document.graceEndsAt);
  const trialEndedAt =
    trialEnds !== null && trialEnds <= now ? document.trialEndsAt : null;

  if (isEntitlementExpired(document, now)) {
    return { kind: "free", trialEndedAt, unverified: true };
  }
  if (document.plan === "free") {
    return { kind: "free", trialEndedAt, unverified: false };
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

// No document — signed out, or nothing verified yet — is Free: the tier is
// what the app can prove, never what it hopes.
export function tierOf(plan: AccountPlan | null): PlanTier {
  return plan !== null && isProPlan(plan) ? "pro" : "free";
}

function timeOf(iso: string | null): number | null {
  if (iso === null) {
    return null;
  }
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : time;
}
