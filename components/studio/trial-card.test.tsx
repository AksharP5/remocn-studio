import { beforeEach, describe, expect, it, mock } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import Page from "@/app/page";
import { ThemeProvider } from "@/components/theme-provider";
import { signedBy, testPublicKey } from "@/lib/studio/entitlement.fixture";

const opened: string[] = [];

const entitlement = await import("@/shared/entitlement");
const publicKey = await testPublicKey();
mock.module("@/shared/entitlement", () => ({
  ...entitlement,
  ENTITLEMENT_PUBLIC_KEY: publicKey,
}));

mock.module("@tauri-apps/plugin-opener", () => ({
  openUrl: (url: string) => {
    opened.push(url);
    return Promise.resolve();
  },
  revealItemInDir: () => Promise.resolve(),
}));

const STORE_RID = 7;
const ORIGIN = "https://remocn.test";
const TRIAL_LINE = /Pro trial\d+ days left/;
const WAITING_LINE = /Finish the purchase in the browser/;
const DAYS_LEFT = /^\d+ days left$/;

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

const signed = signedBy;

const TRIAL = signed({
  devices: [],
  expiresAt: "2099-01-01T00:00:00.000Z",
  graceEndsAt: null,
  issuedAt: "2026-09-06T09:00:00.000Z",
  plan: "pro",
  trialEndsAt: "2099-01-01T00:00:00.000Z",
});

const GRACE = signed({
  devices: [],
  expiresAt: "2099-01-01T00:00:00.000Z",
  graceEndsAt: "2099-01-01T00:00:00.000Z",
  issuedAt: "2026-09-06T09:00:00.000Z",
  plan: "pro",
  trialEndsAt: null,
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
  checkouts?: string[];
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
      if (cmd === "account_checkout") {
        studio.checkouts?.push((payload as { period: string }).period);
        return { checkoutUrl: `${ORIGIN}/checkout/abc` };
      }
      if (cmd === "account_portal") {
        return { url: "https://creem.test/portal/xyz" };
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

  // Buying lives in Settings › Account, where the two tiers are; the card's
  // Upgrade only takes the person there.
  it("opens Settings › Account, whose tiers start the checkout", async () => {
    const studio: Studio = {
      checkouts: [],
      document: TRIAL_OVER,
      settings: [["trialCardsDismissed", JSON.stringify(["invite"])]],
      signedIn: true,
      written: [],
    };
    mockStudio(studio);
    await renderShell();
    await screen.findByText("Your Pro trial ended Sep 1");

    fireEvent.click(screen.getByRole("button", { name: "Upgrade" }));
    const dialog = await screen.findByRole("region", { name: "Settings" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Monthly" }));
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Upgrade to Pro" })
    );

    await waitFor(() => expect(studio.checkouts).toEqual(["month"]));
    await waitFor(() => expect(opened).toEqual([`${ORIGIN}/checkout/abc`]));
    expect(await within(dialog).findByText(WAITING_LINE)).toBeVisible();
  });

  it("sends a declined card to the billing portal", async () => {
    const studio: Studio = {
      document: GRACE,
      settings: [["trialCardsDismissed", JSON.stringify(["invite"])]],
      signedIn: true,
      written: [],
    };
    mockStudio(studio);
    await renderShell();

    expect(await screen.findByText("Your card was declined")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Update card" }));

    await waitFor(() =>
      expect(opened).toEqual(["https://creem.test/portal/xyz"])
    );
  });
});

describe("Settings › Account", () => {
  async function openAccount() {
    fireEvent.click(await screen.findByRole("button", { name: "Account" }));
    await screen.findByRole("region", { name: "Settings" });
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

    const dialog = await screen.findByRole("region", { name: "Settings" });
    expect(
      await within(dialog).findByText("someone@example.com")
    ).toBeVisible();
    expect(within(dialog).getByText("Pro trial")).toBeVisible();
    expect(within(dialog).getByText(DAYS_LEFT)).toBeVisible();
    expect(
      within(dialog).getByRole("progressbar", { name: "Trial spent" })
    ).toBeVisible();
    expect(within(dialog).getByText("Ends Jan 1")).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: "Keep Pro" })
    ).toBeVisible();
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
