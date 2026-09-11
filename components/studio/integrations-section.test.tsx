import { describe, expect, it } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IntegrationsSection } from "@/components/studio/integrations-section";

const ELEVENLABS = {
  authorization: ["api-key"],
  capabilities: ["audio"],
  id: "elevenlabs",
  name: "ElevenLabs",
};

const FIGMA = {
  authorization: ["personal-token"],
  capabilities: ["import"],
  id: "figma",
  name: "Figma",
};

const ADD = /Add integration/;
const ACCOUNT = /studio@remocn\.dev/;
const WORK = /work@remocn\.dev/;
const HOME = /home@remocn\.dev/;
const KEY_GOES = /Its key is deleted/;
const UNREACHED = /could not be reached/;
const FIGMA_NAME = /Figma/;
const ELEVENLABS_NAME = /ElevenLabs/;

function connection(shape: Record<string, unknown> = {}) {
  return {
    account: "studio@remocn.dev",
    capabilities: ["audio"],
    detail: null,
    disabled: false,
    id: "cn_1",
    name: "My ElevenLabs",
    provider: "elevenlabs",
    state: "connected",
    ...shape,
  };
}

function studio(
  options: {
    catalogue?: unknown[];
    connections?: unknown[];
    remove?: unknown;
  } = {}
) {
  const seen: string[] = [];
  let listed = options.connections ?? [];

  mockIPC((cmd) => {
    seen.push(cmd);

    if (cmd === "integrations_catalogue") {
      return options.catalogue ?? [ELEVENLABS, FIGMA];
    }
    if (cmd === "integrations_list") {
      return listed;
    }
    if (cmd === "integrations_remove") {
      listed = [];
      return options.remove ?? { detail: null, withdrawn: true };
    }
    if (cmd === "integrations_cancel") {
      return null;
    }
    return null;
  });

  return seen;
}

describe("the services group", () => {
  it("says nothing is connected, and how to change that", async () => {
    studio();
    render(<IntegrationsSection />);

    expect(await screen.findByText("Nothing is connected yet")).toBeVisible();
    expect(screen.getByRole("button", { name: ADD })).toBeVisible();
  });

  it("offers nothing to add when this build carries no service", async () => {
    studio({ catalogue: [] });
    render(<IntegrationsSection />);

    expect(
      await screen.findByText(
        "This build carries no service the studio can connect to."
      )
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: ADD })).toBeNull();
  });

  it("shows a row with its service, account, capabilities and state", async () => {
    studio({ connections: [connection()] });
    render(<IntegrationsSection />);

    expect(await screen.findByText("My ElevenLabs")).toBeVisible();
    expect(screen.getByText("elevenlabs")).toBeVisible();
    expect(screen.getByText(ACCOUNT)).toBeVisible();
    expect(screen.getByText("Connected")).toBeVisible();
  });

  it("tells two connections of one service apart by name and account", async () => {
    studio({
      connections: [
        connection({ account: "work@remocn.dev", id: "cn_1", name: "Work" }),
        connection({ account: "home@remocn.dev", id: "cn_2", name: "Home" }),
      ],
    });
    render(<IntegrationsSection />);

    expect(await screen.findByText("Work")).toBeVisible();
    expect(screen.getByText("Home")).toBeVisible();
    expect(screen.getByText(WORK)).toBeVisible();
    expect(screen.getByText(HOME)).toBeVisible();
  });

  it("says a connection needs authorizing, in the service's own words", async () => {
    studio({
      connections: [
        connection({
          detail: "ElevenLabs rejected that key.",
          state: "needs-authorization",
        }),
      ],
    });
    render(<IntegrationsSection />);

    expect(await screen.findByText("Action needed")).toBeVisible();
    expect(screen.getByText("ElevenLabs rejected that key.")).toBeVisible();
  });

  it("reads a disabled connection as off rather than as connected", async () => {
    studio({ connections: [connection({ disabled: true })] });
    render(<IntegrationsSection />);

    expect(await screen.findByText("Off")).toBeVisible();
    expect(screen.queryByText("Connected")).toBeNull();
    expect(screen.getByRole("button", { name: "Enable" })).toBeVisible();
  });
});

describe("removing a connection", () => {
  it("asks first, and names what goes with it", async () => {
    studio({ connections: [connection()] });
    render(<IntegrationsSection />);
    await screen.findByText("My ElevenLabs");

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.getByText(KEY_GOES)).toBeVisible();
    expect(screen.getByRole("button", { name: "Keep it" })).toBeVisible();
  });

  it("removes nothing while the question stands", async () => {
    const seen = studio({ connections: [connection()] });
    render(<IntegrationsSection />);
    await screen.findByText("My ElevenLabs");

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));

    expect(seen).not.toContain("integrations_remove");
    expect(screen.getByText("My ElevenLabs")).toBeVisible();
  });

  it("says so when the service could not be told", async () => {
    studio({
      connections: [connection()],
      remove: {
        detail:
          "ElevenLabs could not be reached, so the key may still work there.",
        withdrawn: false,
      },
    });
    render(<IntegrationsSection />);
    await screen.findByText("My ElevenLabs");

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Remove" }).at(-1) as HTMLElement
    );

    expect(await screen.findByText(UNREACHED)).toBeVisible();
  });
});

describe("adding an integration", () => {
  it("walks choose, then authorize, without a mouse", async () => {
    studio();
    render(<IntegrationsSection />);

    const add = await screen.findByRole("button", { name: ADD });
    add.focus();
    expect(add).toHaveFocus();
    fireEvent.click(add);

    expect(await screen.findByText("Choose a service")).toBeVisible();

    const figma = screen.getByRole("button", { name: FIGMA_NAME });
    figma.focus();
    expect(figma).toHaveFocus();
    fireEvent.click(figma);

    expect(
      await screen.findByLabelText("Personal access token for Figma")
    ).toBeVisible();
  });

  it("asks for the right kind of secret per service", async () => {
    studio();
    render(<IntegrationsSection />);

    fireEvent.click(await screen.findByRole("button", { name: ADD }));
    fireEvent.click(screen.getByRole("button", { name: ELEVENLABS_NAME }));

    expect(
      await screen.findByLabelText("API key for ElevenLabs")
    ).toBeVisible();
  });

  it("never shows a stored secret back", async () => {
    studio();
    render(<IntegrationsSection />);

    fireEvent.click(await screen.findByRole("button", { name: ADD }));
    fireEvent.click(screen.getByRole("button", { name: ELEVENLABS_NAME }));

    const field = (await screen.findByLabelText(
      "API key for ElevenLabs"
    )) as HTMLInputElement;

    expect(field.type).toBe("password");
    expect(field.value).toBe("");
  });

  it("leaves the list as it was when the add is cancelled", async () => {
    studio({ connections: [connection()] });
    render(<IntegrationsSection />);
    await screen.findByText("My ElevenLabs");

    fireEvent.click(screen.getByRole("button", { name: ADD }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByText("Choose a service")).toBeNull()
    );
    expect(screen.getByText("My ElevenLabs")).toBeVisible();
  });
});
