import { describe, expect, it } from "bun:test";
import { isOnFree, trialCardOf } from "./trial-card";

describe("trialCardOf", () => {
  it("shows nothing until the core has answered whether anyone is signed in", () => {
    expect(trialCardOf({ kind: "unknown" }, [])).toBeNull();
  });

  it("invites a signed-out person, and keeps the card while they sign in", () => {
    expect(trialCardOf({ kind: "signedOut" }, [])?.kind).toBe("invite");
    expect(trialCardOf({ kind: "signingIn" }, [])?.kind).toBe("invite");
  });

  it("remembers that the invite was closed", () => {
    expect(trialCardOf({ kind: "signedOut" }, ["invite"])).toBeNull();
  });

  it("says nothing to someone on a trial or a subscription", () => {
    expect(
      trialCardOf(
        {
          kind: "signedIn",
          plan: {
            endsAt: "2026-09-11T00:00:00Z",
            kind: "trial",
            startedAt: null,
          },
        },
        []
      )
    ).toBeNull();
    expect(
      trialCardOf({ kind: "signedIn", plan: { kind: "pro" } }, [])
    ).toBeNull();
  });

  it("says nothing while the plan is still being read", () => {
    expect(trialCardOf({ kind: "signedIn", plan: null }, [])).toBeNull();
  });

  it("comes back when the trial ends, once per trial", () => {
    const account = {
      kind: "signedIn" as const,
      plan: {
        kind: "free" as const,
        trialEndedAt: "2026-09-01T00:00:00Z",
        unverified: false,
      },
    };
    expect(trialCardOf(account, ["invite"])).toEqual({
      id: "trial-ended:2026-09-01T00:00:00Z",
      kind: "trialEnded",
      until: "2026-09-01T00:00:00Z",
    });
    expect(
      trialCardOf(account, ["trial-ended:2026-09-01T00:00:00Z"])
    ).toBeNull();
  });

  it("is quiet for a free account that never had a trial", () => {
    expect(
      trialCardOf(
        {
          kind: "signedIn",
          plan: { kind: "free", trialEndedAt: null, unverified: false },
        },
        []
      )
    ).toBeNull();
  });

  it("warns during grace, keyed on when it ends", () => {
    expect(
      trialCardOf(
        {
          kind: "signedIn",
          plan: { accessUntil: "2026-09-09T00:00:00Z", kind: "grace" },
        },
        []
      )
    ).toEqual({
      id: "grace:2026-09-09T00:00:00Z",
      kind: "grace",
      until: "2026-09-09T00:00:00Z",
    });
  });
});

describe("isOnFree", () => {
  it("counts signed out and a free plan, never an unread one", () => {
    expect(isOnFree({ kind: "signedOut" })).toBe(true);
    expect(
      isOnFree({
        kind: "signedIn",
        plan: { kind: "free", trialEndedAt: null, unverified: false },
      })
    ).toBe(true);
    expect(isOnFree({ kind: "signedIn", plan: null })).toBe(false);
    expect(isOnFree({ kind: "signedIn", plan: { kind: "pro" } })).toBe(false);
    expect(isOnFree({ kind: "unknown" })).toBe(false);
  });
});
