import { afterEach, describe, expect, it, mock } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ProviderSteps } from "@/components/studio/provider-steps";
import { linuxSetupCommand } from "@/lib/studio/terminal";
import { stubGlobal, unstubAllGlobals } from "@/test/stub-global";

afterEach(unstubAllGlobals);

describe("provider terminal setup", () => {
  it.each([
    ["Macintosh", "⌘V, then Enter"],
    ["X11; Linux x86_64", "Ctrl+Shift+V, then Enter"],
  ])("shows the terminal paste shortcut on %s", async (userAgent, label) => {
    const writeText = mock(() => Promise.resolve());
    const opened: string[] = [];
    stubGlobal("navigator", { clipboard: { writeText }, userAgent });
    mockIPC((command) => {
      if (command === "open_terminal") {
        opened.push(command);
        return null;
      }
      throw new Error(`unexpected command: ${command}`);
    });
    render(<ProviderSteps provider="codex" row={undefined} />);

    const [install] = screen.getAllByRole("button", {
      name: "Open in Terminal",
    });
    if (install === undefined) {
      throw new Error("the provider install action is missing");
    }
    fireEvent.click(install);

    expect(await screen.findByRole("button", { name: label })).toBeVisible();
    expect(writeText).toHaveBeenCalledWith("npm install -g @openai/codex");
    expect(opened).toEqual(["open_terminal"]);
  });

  it("displays and copies the same Linux runtime prefix for installation and sign-in", async () => {
    const data = "/home/alice/.local/share/Studio's data";
    const writeText = mock(() => Promise.resolve());
    stubGlobal("isTauri", true);
    stubGlobal("navigator", {
      clipboard: { writeText },
      userAgent: "X11; Linux x86_64",
    });
    mockIPC((command) => {
      if (command === "plugin:path|resolve_directory") {
        return data;
      }
      throw new Error(`unexpected command: ${command}`);
    });
    render(<ProviderSteps provider="codex" row={undefined} />);

    const install = linuxSetupCommand("npm install -g @openai/codex", data);
    const signin = linuxSetupCommand("codex login", data);
    const installRow = (await screen.findByText(install)).closest("li");
    const signinRow = screen.getByText(signin).closest("li");
    if (installRow === null || signinRow === null) {
      throw new Error("the provider setup steps are missing");
    }

    fireEvent.click(within(installRow).getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(install));
    fireEvent.click(within(signinRow).getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(signin));
  });
});
