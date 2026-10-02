import { afterEach, describe, expect, it, mock } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProviderSteps } from "@/components/studio/provider-steps";
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
});
