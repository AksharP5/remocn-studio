import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import {
  decodeEntitlement,
  decodeEntitlementPayload,
  type EntitlementDocument,
  planAt,
} from "./entitlement";

// The document `buildEntitlement` in the landing repo produces, signed by
// `signEntitlement`: base64 of the JSON, an Ed25519 signature over those
// ASCII bytes. The signature here is not a real one — verifying it is
// REM-346's; this pins the shape.
const DOCUMENT: EntitlementDocument = {
  devices: [
    {
      id: "ses_1",
      lastSeenAt: "2026-09-06T09:00:00.000Z",
      name: "MacBook Pro",
    },
  ],
  expiresAt: "2026-09-13T09:00:00.000Z",
  graceEndsAt: null,
  issuedAt: "2026-09-06T09:00:00.000Z",
  plan: "pro",
  trialEndsAt: "2026-09-11T09:00:00.000Z",
};

const SERVER_ANSWER = {
  algorithm: "ed25519",
  payload: btoa(JSON.stringify(DOCUMENT)),
  signature: "c2lnbmF0dXJl",
};

const NOW = Date.parse("2026-09-06T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("decodeEntitlement", () => {
  it("reads the server's signed envelope back into the document", () => {
    const exit = Effect.runSyncExit(decodeEntitlement(SERVER_ANSWER));
    expect(Exit.isSuccess(exit) && exit.value).toEqual(DOCUMENT);
  });

  it("refuses an envelope with another algorithm", () => {
    const exit = Effect.runSyncExit(
      decodeEntitlement({ ...SERVER_ANSWER, algorithm: "hs256" })
    );
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("refuses a payload that is not base64 JSON", () => {
    expect(Exit.isFailure(decodeEntitlementPayload("not base64!"))).toBe(true);
    expect(Exit.isFailure(decodeEntitlementPayload(btoa("[]")))).toBe(true);
  });
});

describe("planAt", () => {
  it("is a trial while the trial runs on a pro document", () => {
    expect(planAt(DOCUMENT, NOW)).toEqual({
      endsAt: DOCUMENT.trialEndsAt,
      kind: "trial",
      startedAt: null,
    });
    expect(
      planAt({ ...DOCUMENT, trialStartedAt: "2026-09-04T09:00:00.000Z" }, NOW)
    ).toMatchObject({ startedAt: "2026-09-04T09:00:00.000Z" });
  });

  it("is pro once the trial is over and the plan still says pro", () => {
    expect(planAt(DOCUMENT, NOW + 10 * DAY)).toEqual({ kind: "pro" });
  });

  it("is pro with no trial on record", () => {
    expect(planAt({ ...DOCUMENT, trialEndsAt: null }, NOW)).toEqual({
      kind: "pro",
    });
  });

  it("is grace while the card has failed and access is kept", () => {
    const graceEndsAt = "2026-09-09T09:00:00.000Z";
    expect(
      planAt({ ...DOCUMENT, graceEndsAt, trialEndsAt: null }, NOW)
    ).toEqual({ accessUntil: graceEndsAt, kind: "grace" });
  });

  it("is free, remembering the trial that ended", () => {
    expect(
      planAt(
        { ...DOCUMENT, plan: "free", trialEndsAt: "2026-09-01T09:00:00.000Z" },
        NOW
      )
    ).toEqual({ kind: "free", trialEndedAt: "2026-09-01T09:00:00.000Z" });
  });

  it("is free with no trial ended when the server never started one", () => {
    expect(
      planAt({ ...DOCUMENT, plan: "free", trialEndsAt: null }, NOW)
    ).toEqual({ kind: "free", trialEndedAt: null });
  });

  it("never counts a free document's trial as running", () => {
    expect(planAt({ ...DOCUMENT, plan: "free" }, NOW)).toEqual({
      kind: "free",
      trialEndedAt: null,
    });
  });
});
