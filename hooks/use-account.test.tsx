import { mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAccount } from "@/hooks/use-account";
import type { EntitlementCache } from "@/lib/studio/entitlement";
import { signedBy } from "@/lib/studio/entitlement.fixture";
import type { SignInPoll } from "@/shared/account";
import type { SignedEntitlement } from "@/shared/entitlement";

const opened: string[] = [];

// The hook verifies every document against the shipped public key, so the
// tests sign with a pair of their own and swap the public half in.
vi.mock("@/shared/entitlement", async (importOriginal) => {
  const original = await importOriginal<object>();
  const { testPublicKey } = await import("@/lib/studio/entitlement.fixture");
  return { ...original, ENTITLEMENT_PUBLIC_KEY: await testPublicKey() };
});

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: (url: string) => {
    opened.push(url);
    return Promise.resolve();
  },
}));

const ORIGIN = "https://remocn.test";
const UNAUTHORIZED = { kind: "unauthorized", message: "Sign in first." };
const DECLINED = /declined/;
const EXPIRED = /expired/;
const SIGNED_OUT = /signed out/;
const UNREACHABLE = /could not reach/;
const NOT_SIGNED = /not signed/;

const ME = {
  devices: [
    {
      id: "ses_this",
      lastSeenAt: "2026-09-06T09:00:00.000Z",
      name: "MacBook Pro",
      platform: "macos" as const,
    },
    {
      id: "ses_other",
      lastSeenAt: "2026-09-01T09:00:00.000Z",
      name: "Mac mini",
      platform: "macos" as const,
    },
  ],
  session: { expiresAt: "2026-12-05T09:00:00.000Z", id: "ses_this" },
  user: {
    email: "someone@example.com",
    emailVerified: true,
    id: "usr_1",
    image: null,
    name: "Someone",
  },
};

const DOCUMENT = {
  devices: [],
  expiresAt: "2099-01-01T00:00:00.000Z",
  graceEndsAt: null,
  issuedAt: "2026-09-06T09:00:00.000Z",
  plan: "pro",
  trialEndsAt: "2099-01-01T00:00:00.000Z",
};

const STALE = {
  ...DOCUMENT,
  expiresAt: "2026-01-01T00:00:00.000Z",
  trialEndsAt: "2026-01-01T00:00:00.000Z",
};

const OFFLINE = { kind: "offline", message: "The studio could not reach it." };

interface Core {
  calls: string[];
  document?: Record<string, unknown>;
  offline?: boolean;
  polls: SignInPoll[];
  signedIn: boolean;
}

function memoryCache(initial: SignedEntitlement | null = null) {
  const state = { stored: initial };
  const cache: EntitlementCache = {
    clear: Effect.sync(() => {
      state.stored = null;
    }),
    read: Effect.sync(() => state.stored),
    write: (signed) =>
      Effect.sync(() => {
        state.stored = signed;
      }),
  };
  return { cache, state };
}

function mockCore(core: Core) {
  mockIPC((cmd, payload) => {
    core.calls.push(cmd);
    switch (cmd) {
      case "account_status":
        return { origin: ORIGIN, signedIn: core.signedIn };
      case "account_sign_in_start":
        return {
          expiresIn: 1800,
          interval: 5,
          userCode: "ABCD-EFGH",
          verificationUri: `${ORIGIN}/device?user_code=ABCDEFGH`,
        };
      case "account_sign_in_poll": {
        const answer = core.polls.shift() ?? { status: "pending" };
        if (answer.status === "signedIn") {
          core.signedIn = true;
        }
        return answer;
      }
      case "account_sign_in_cancel":
        return null;
      case "account_me":
        if (core.offline === true) {
          return Promise.reject(OFFLINE);
        }
        return core.signedIn ? ME : Promise.reject(UNAUTHORIZED);
      case "account_entitlement":
        if (core.offline === true) {
          return Promise.reject(OFFLINE);
        }
        return core.signedIn
          ? signedBy(core.document ?? DOCUMENT)
          : Promise.reject(UNAUTHORIZED);
      case "account_revoke_device":
        core.calls.push(`revoke:${(payload as { id: string }).id}`);
        return null;
      case "account_sign_out":
        core.signedIn = false;
        return null;
      default:
        throw new Error(`unexpected command: ${cmd}`);
    }
  });
}

// The wait between polls is a gate the test opens: a poll happens when the
// test says so, never on a timer, so the flow is stepped rather than raced.
function gate() {
  const waiters: (() => void)[] = [];
  return {
    release: () => {
      waiters.shift()?.();
    },
    sleep: () =>
      Effect.callback<void>((resume) => {
        waiters.push(() => resume(Effect.void));
      }),
  };
}

function mount(cache: EntitlementCache = memoryCache().cache) {
  const clock = gate();
  const view = renderHook(() => useAccount({ cache, sleep: clock.sleep }));
  return { ...view, release: () => act(() => clock.release()) };
}

function polls(core: Core) {
  return core.calls.filter((call) => call === "account_sign_in_poll").length;
}

beforeEach(() => {
  opened.length = 0;
});

describe("useAccount", () => {
  it("starts signed out when the keychain holds nothing", async () => {
    const core: Core = { calls: [], polls: [], signedIn: false };
    mockCore(core);
    const { result } = mount();

    await waitFor(() => expect(result.current.phase.kind).toBe("signedOut"));
    expect(result.current.origin).toBe(ORIGIN);
    expect(core.calls).not.toContain("account_me");
  });

  it("stays unknown when there is no core to ask", async () => {
    mockIPC(() => {
      throw new Error("no core");
    });
    const { result } = mount();

    await act(() => Promise.resolve());
    expect(result.current.phase.kind).toBe("unknown");
    expect(result.current.error).toBeNull();
  });

  it("reads the account and the plan when a token is stored", async () => {
    const core: Core = { calls: [], polls: [], signedIn: true };
    mockCore(core);
    const { result } = mount();

    await waitFor(() => expect(result.current.phase.kind).toBe("signedIn"));
    const { phase } = result.current;
    expect(phase.kind === "signedIn" && phase.me?.user.email).toBe(
      "someone@example.com"
    );
    expect(result.current.plan?.kind).toBe("trial");
  });

  it("opens the browser, polls until confirmed, then loads the account", async () => {
    const core: Core = {
      calls: [],
      polls: [
        { status: "pending" },
        { status: "slowDown" },
        { status: "signedIn" },
      ],
      signedIn: false,
    };
    mockCore(core);
    const { release, result } = mount();
    await waitFor(() => expect(result.current.phase.kind).toBe("signedOut"));

    act(() => result.current.signIn());

    await waitFor(() => expect(result.current.phase.kind).toBe("signingIn"));
    expect(opened).toEqual([`${ORIGIN}/device?user_code=ABCDEFGH`]);
    const { phase } = result.current;
    expect(phase.kind === "signingIn" && phase.userCode).toBe("ABCD-EFGH");
    expect(polls(core)).toBe(0);

    await release();
    await waitFor(() => expect(polls(core)).toBe(1));
    await release();
    await waitFor(() => expect(polls(core)).toBe(2));
    expect(result.current.phase.kind).toBe("signingIn");
    await release();

    await waitFor(() => expect(result.current.phase.kind).toBe("signedIn"));
    expect(polls(core)).toBe(3);
    expect(result.current.error).toBeNull();
  });

  it("cancelling tells the core and returns to signed out", async () => {
    const core: Core = { calls: [], polls: [], signedIn: false };
    mockCore(core);
    const { result } = mount();
    await waitFor(() => expect(result.current.phase.kind).toBe("signedOut"));

    act(() => result.current.signIn());
    await waitFor(() => expect(result.current.phase.kind).toBe("signingIn"));

    act(() => result.current.cancelSignIn());

    await waitFor(() => expect(result.current.phase.kind).toBe("signedOut"));
    await waitFor(() => expect(core.calls).toContain("account_sign_in_cancel"));
    expect(result.current.error).toBeNull();
    expect(polls(core)).toBe(0);
  });

  it("names a declined sign-in and an expired code", async () => {
    const core: Core = {
      calls: [],
      polls: [{ status: "denied" }],
      signedIn: false,
    };
    mockCore(core);
    const { release, result } = mount();
    await waitFor(() => expect(result.current.phase.kind).toBe("signedOut"));

    act(() => result.current.signIn());
    await waitFor(() => expect(result.current.phase.kind).toBe("signingIn"));
    await release();
    await waitFor(() => expect(result.current.error).toMatch(DECLINED));
    expect(result.current.phase.kind).toBe("signedOut");

    core.polls.push({ status: "expired" });
    act(() => result.current.signIn());
    await waitFor(() => expect(result.current.phase.kind).toBe("signingIn"));
    await release();
    await waitFor(() => expect(result.current.error).toMatch(EXPIRED));
  });

  it("keeps the devices when the limit is hit, so the person can pick", async () => {
    const core: Core = {
      calls: [],
      polls: [
        {
          devices: ME.devices,
          message: "Signed in on 2 devices already.",
          status: "deviceLimit",
        },
      ],
      signedIn: false,
    };
    mockCore(core);
    const { release, result } = mount();
    await waitFor(() => expect(result.current.phase.kind).toBe("signedOut"));

    act(() => result.current.signIn());
    await waitFor(() => expect(result.current.phase.kind).toBe("signingIn"));
    await release();

    await waitFor(() =>
      expect(result.current.deviceLimit?.devices).toHaveLength(2)
    );
    expect(result.current.phase.kind).toBe("signedOut");
  });

  it("signs out through the core and forgets the account", async () => {
    const core: Core = { calls: [], polls: [], signedIn: true };
    mockCore(core);
    const { result } = mount();
    await waitFor(() => expect(result.current.phase.kind).toBe("signedIn"));

    act(() => result.current.signOut());

    await waitFor(() => expect(result.current.phase.kind).toBe("signedOut"));
    expect(core.calls).toContain("account_sign_out");
  });

  it("revokes another device and reads the list again", async () => {
    const core: Core = { calls: [], polls: [], signedIn: true };
    mockCore(core);
    const { result } = mount();
    await waitFor(() => expect(result.current.phase.kind).toBe("signedIn"));
    const before = core.calls.filter((call) => call === "account_me").length;

    act(() =>
      result.current.revokeDevice({
        currentTarget: { value: "ses_other" },
      } as never)
    );

    await waitFor(() => expect(core.calls).toContain("revoke:ses_other"));
    await waitFor(() =>
      expect(core.calls.filter((call) => call === "account_me").length).toBe(
        before + 1
      )
    );
    expect(result.current.phase.kind).toBe("signedIn");
  });

  it("treats a 401 on refresh as this device having been signed out", async () => {
    const core: Core = { calls: [], polls: [], signedIn: true };
    mockCore(core);
    const { result } = mount();
    await waitFor(() => expect(result.current.phase.kind).toBe("signedIn"));

    core.signedIn = false;
    act(() => result.current.refresh());

    await waitFor(() => expect(result.current.phase.kind).toBe("signedOut"));
    expect(result.current.error).toMatch(SIGNED_OUT);
  });

  it("caches the signed document and reads it back when the server is unreachable", async () => {
    const { cache, state } = memoryCache();
    const core: Core = { calls: [], polls: [], signedIn: true };
    mockCore(core);
    const { result } = mount(cache);
    await waitFor(() => expect(result.current.plan?.kind).toBe("trial"));
    expect(state.stored).not.toBeNull();

    core.offline = true;
    act(() => result.current.refresh());

    await waitFor(() => expect(result.current.isBusy).toBe(false));
    expect(result.current.phase.kind).toBe("signedIn");
    expect(result.current.plan?.kind).toBe("trial");
    expect(result.current.tier).toBe("pro");
    expect(result.current.error).toMatch(UNREACHABLE);
  });

  it("is free and says so once the cached document has expired", async () => {
    const { cache } = memoryCache(await signedBy(STALE));
    const core: Core = { calls: [], offline: true, polls: [], signedIn: true };
    mockCore(core);
    const { result } = mount(cache);

    await waitFor(() => expect(result.current.phase.kind).toBe("signedIn"));
    expect(result.current.plan).toEqual({
      kind: "free",
      trialEndedAt: STALE.trialEndsAt,
      unverified: true,
    });
    expect(result.current.tier).toBe("free");
  });

  it("refuses a document that is not signed by the server", async () => {
    const core: Core = { calls: [], polls: [], signedIn: true };
    mockIPC((cmd) => {
      if (cmd === "account_status") {
        return { origin: ORIGIN, signedIn: true };
      }
      if (cmd === "account_me") {
        return ME;
      }
      if (cmd === "account_entitlement") {
        return {
          algorithm: "ed25519",
          payload: btoa(JSON.stringify(DOCUMENT)),
          signature: "c2ln",
        };
      }
      throw new Error(`unexpected command: ${cmd}`);
    });
    const { result } = mount();

    await waitFor(() => expect(result.current.phase.kind).toBe("signedIn"));
    expect(result.current.plan).toBeNull();
    expect(result.current.tier).toBe("free");
    expect(result.current.error).toMatch(NOT_SIGNED);
    expect(core.calls).toEqual([]);
  });

  it("forgets the cached document when the device is signed out", async () => {
    const { cache, state } = memoryCache();
    const core: Core = { calls: [], polls: [], signedIn: true };
    mockCore(core);
    const { result } = mount(cache);
    await waitFor(() => expect(state.stored).not.toBeNull());

    core.signedIn = false;
    act(() => result.current.refresh());

    await waitFor(() => expect(result.current.phase.kind).toBe("signedOut"));
    expect(state.stored).toBeNull();
    expect(result.current.tier).toBe("free");
  });

  it("reads the plan again once a day while signed in", async () => {
    const core: Core = { calls: [], polls: [], signedIn: true };
    mockCore(core);
    const { release, result } = mount();
    await waitFor(() => expect(result.current.phase.kind).toBe("signedIn"));
    const before = core.calls.filter((call) => call === "account_entitlement");

    core.document = {
      ...DOCUMENT,
      plan: "free",
      trialEndsAt: "2026-01-01T00:00:00.000Z",
    };
    release();

    await waitFor(() =>
      expect(
        core.calls.filter((call) => call === "account_entitlement").length
      ).toBe(before.length + 1)
    );
    await waitFor(() => expect(result.current.tier).toBe("free"));
  });
});
