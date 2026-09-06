import { mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAccount } from "@/hooks/use-account";
import type { SignInPoll } from "@/shared/account";

const opened: string[] = [];

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

const SIGNED = {
  algorithm: "ed25519",
  payload: btoa(JSON.stringify(DOCUMENT)),
  signature: "c2ln",
};

interface Core {
  calls: string[];
  polls: SignInPoll[];
  signedIn: boolean;
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
        return core.signedIn ? ME : Promise.reject(UNAUTHORIZED);
      case "account_entitlement":
        return core.signedIn ? SIGNED : Promise.reject(UNAUTHORIZED);
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

function mount() {
  const clock = gate();
  const view = renderHook(() => useAccount({ sleep: clock.sleep }));
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
});
