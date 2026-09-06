import { mockIPC } from "@tauri-apps/api/mocks";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "@/app/page";
import { ThemeProvider } from "@/components/theme-provider";

const opened: string[] = [];

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: (url: string) => {
    opened.push(url);
    return Promise.resolve();
  },
  revealItemInDir: () => Promise.resolve(),
}));

const STORE_RID = 7;
const ORIGIN = "https://remocn.test";
const TRIAL_LINE = /Pro trial\d+ days left/;

const SIDECAR_READY = {
  attempt: 0,
  detail: null,
  logPath: "/tmp/sidecar.log",
  phase: "ready",
  pid: 1234,
};

const ME = {
  devices: [
    {
      id: "ses_this",
      lastSeenAt: "2026-09-06T09:00:00.000Z",
      name: "MacBook Pro",
      platform: "macos",
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

function signed(document: Record<string, unknown>) {
  return {
    algorithm: "ed25519",
    payload: btoa(JSON.stringify(document)),
    signature: "c2ln",
  };
}

const TRIAL = signed({
  devices: [],
  expiresAt: "2099-01-01T00:00:00.000Z",
  graceEndsAt: null,
  issuedAt: "2026-09-06T09:00:00.000Z",
  plan: "pro",
  trialEndsAt: "2099-01-01T00:00:00.000Z",
});

const TRIAL_OVER = signed({
  devices: [],
  expiresAt: "2099-01-01T00:00:00.000Z",
  graceEndsAt: null,
  issuedAt: "2026-09-06T09:00:00.000Z",
  plan: "free",
  trialEndsAt: "2026-09-01T09:00:00.000Z",
});

interface Studio {
  document?: ReturnType<typeof signed>;
  settings?: [string, string][];
  signedIn: boolean;
  written: [string, unknown][];
}

function mockStudio(studio: Studio) {
  mockIPC(
    (cmd, payload) => {
      if (cmd === "plugin:store|load") {
        return STORE_RID;
      }
      if (cmd === "plugin:store|entries") {
        return studio.settings ?? [];
      }
      if (cmd === "plugin:store|set") {
        const { key, value } = payload as { key: string; value: unknown };
        studio.written.push([key, value]);
        return null;
      }
      if (cmd === "studio_build") {
        return { environment: "development", os: "15.5", version: "0.3.0" };
      }
      if (cmd === "sidecar_status") {
        return SIDECAR_READY;
      }
      if (cmd === "account_status") {
        return { origin: ORIGIN, signedIn: studio.signedIn };
      }
      if (cmd === "account_me") {
        return ME;
      }
      if (cmd === "account_entitlement") {
        return studio.document ?? TRIAL;
      }
      if (cmd === "account_sign_in_start") {
        return {
          expiresIn: 1800,
          interval: 5,
          userCode: "ABCD-EFGH",
          verificationUri: `${ORIGIN}/device?user_code=ABCDEFGH`,
        };
      }
      if (cmd === "account_sign_in_poll") {
        return { status: "pending" };
      }
      if (cmd === "account_sign_in_cancel" || cmd === "account_sign_out") {
        return null;
      }
      if (cmd === "sidecar_request") {
        const { method } = payload as { method: string };
        if (
          method === "agent.accounts" ||
          method === "history.sessions" ||
          method === "library.list" ||
          method === "project.list"
        ) {
          return [];
        }
        throw new Error(`unexpected sidecar method: ${method}`);
      }
      throw new Error(`unexpected command: ${cmd}`);
    },
    { shouldMockEvents: true }
  );
}

async function renderShell() {
  render(
    <ThemeProvider>
      <Page />
    </ThemeProvider>
  );
  await screen.findByRole("heading", { name: "Videos" });
}

function card() {
  return screen.queryByRole("region", { name: "Pro trial" });
}

beforeEach(() => {
  opened.length = 0;
});

describe("the trial card", () => {
  it("invites a signed-out person to a trial, once", async () => {
    const studio: Studio = { signedIn: false, written: [] };
    mockStudio(studio);
    await renderShell();

    expect(await screen.findByText("7 days of Pro, free")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    await waitFor(() => expect(card()).toBeNull());
    expect(studio.written).toContainEqual([
      "trialCardsDismissed",
      JSON.stringify(["invite"]),
    ]);
  });

  it("stays away once it was closed on an earlier launch", async () => {
    const studio: Studio = {
      settings: [["trialCardsDismissed", JSON.stringify(["invite"])]],
      signedIn: false,
      written: [],
    };
    mockStudio(studio);
    await renderShell();

    await screen.findByRole("button", { name: "Settings" });
    expect(card()).toBeNull();
  });

  it("opens the browser from its Sign in and shows the code", async () => {
    const studio: Studio = { signedIn: false, written: [] };
    mockStudio(studio);
    await renderShell();
    await screen.findByText("7 days of Pro, free");

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("ABCD-EFGH")).toBeVisible();
    expect(opened).toEqual([`${ORIGIN}/device?user_code=ABCDEFGH`]);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      await screen.findByRole("button", { name: "Sign in" })
    ).toBeVisible();
  });

  it("is quiet for someone on a trial", async () => {
    const studio: Studio = { signedIn: true, written: [] };
    mockStudio(studio);
    await renderShell();

    await screen.findByRole("button", { name: "Settings" });
    expect(card()).toBeNull();
  });

  it("comes back when the trial has ended", async () => {
    const studio: Studio = {
      document: TRIAL_OVER,
      settings: [["trialCardsDismissed", JSON.stringify(["invite"])]],
      signedIn: true,
      written: [],
    };
    mockStudio(studio);
    await renderShell();

    expect(await screen.findByText("Your Pro trial ended Sep 1")).toBeVisible();
    expect(screen.getByRole("button", { name: "Upgrade" })).toBeVisible();
  });
});

describe("Settings › Account", () => {
  async function openAccount() {
    fireEvent.click(await screen.findByRole("button", { name: "Account" }));
    await screen.findByRole("dialog");
  }

  it("offers Sign in while nobody is", async () => {
    const studio: Studio = { signedIn: false, written: [] };
    mockStudio(studio);
    await renderShell();
    await openAccount();

    expect(
      await screen.findByRole("heading", { name: "Account" })
    ).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Sign in" })).not.toHaveLength(
      0
    );
  });

  it("shows the email, the plan and the devices when signed in", async () => {
    const studio: Studio = { signedIn: true, written: [] };
    mockStudio(studio);
    await renderShell();

    const row = await screen.findByRole("button", { name: "Account" });
    await waitFor(() => expect(row).toHaveTextContent("Someone"));
    expect(row).toHaveTextContent(TRIAL_LINE);
    expect(
      within(row).getByRole("progressbar", { name: "Trial spent" })
    ).toBeVisible();

    await openAccount();

    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByText("someone@example.com")
    ).toBeVisible();
    expect(within(dialog).getByText("Pro trial")).toBeVisible();
    expect(screen.getByText("MacBook Pro")).toBeVisible();
    expect(screen.getByText("· This Mac")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Manage billing" })
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Manage billing" }));
    await waitFor(() => expect(opened).toEqual([`${ORIGIN}/account/billing`]));

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(
      await screen.findAllByRole("button", { name: "Sign in" })
    ).not.toHaveLength(0);
  });
});
