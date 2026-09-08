import { describe, expect, it, mock } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { EnvironmentChecklist } from "@/components/studio/environment-checklist";
import type { Environment } from "@/hooks/use-environment";
import type { EnvironmentCheck } from "@/shared/ipc";

const UPGRADE_BUTTON = /Upgrade Remotion/;

const OUTDATED: EnvironmentCheck = {
  detail: "This project declares remotion 4.0.481.",
  fix: {
    packages: ["@remotion/cli", "remotion"],
    type: "upgrade",
    version: "4.0.520",
  },
  id: "remotion",
  state: "warn",
  title: "Text and type editing needs Remotion 4.0.513 or newer",
};

function environment(
  troubles: readonly EnvironmentCheck[],
  overrides: Partial<Environment> = {}
): Environment {
  return {
    checks: troubles,
    download: null,
    error: null,
    install: mock(),
    installNode: mock(),
    isBlocking: false,
    isChecking: false,
    isInstalling: false,
    isInstallingNode: false,
    isUpgrading: false,
    output: null,
    recheck: mock(),
    troubles,
    upgrade: mock(),
    ...overrides,
  };
}

describe("the Upgrade Remotion row", () => {
  it("offers the upgrade, and runs nothing until it is pressed", () => {
    const upgrade = mock();

    render(
      <EnvironmentChecklist
        environment={environment([OUTDATED], { upgrade })}
      />
    );

    expect(
      screen.getByText("Text and type editing needs Remotion 4.0.513 or newer")
    ).toBeDefined();
    expect(upgrade).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Upgrade Remotion" }));

    expect(upgrade).toHaveBeenCalledTimes(1);
  });

  it("shows what the manager is saying while it runs", () => {
    render(
      <EnvironmentChecklist
        environment={environment([OUTDATED], {
          isUpgrading: true,
          output: "resolving @remotion/cli",
        })}
      />
    );

    const button = screen.getByRole("button", { name: UPGRADE_BUTTON });

    expect(button.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("resolving @remotion/cli")).toBeDefined();
  });

  it("does not claim a project that only warns cannot run", () => {
    render(<EnvironmentChecklist environment={environment([OUTDATED])} />);

    expect(
      screen.getByText("This project has one thing worth fixing")
    ).toBeDefined();
  });

  it("still says a project is not ready when something failed", () => {
    render(
      <EnvironmentChecklist
        environment={environment([
          OUTDATED,
          {
            detail: null,
            fix: { type: "install" },
            id: "dependencies",
            state: "failed",
            title: "Dependencies are not installed",
          },
        ])}
      />
    );

    expect(screen.getByText("This project is not ready to run")).toBeDefined();
  });

  it("offers no upgrade for a row whose fix is something else", () => {
    render(
      <EnvironmentChecklist
        environment={environment([
          {
            detail: null,
            fix: { type: "install" },
            id: "dependencies",
            state: "failed",
            title: "Dependencies are not installed",
          },
        ])}
      />
    );

    expect(
      screen.queryByRole("button", { name: "Upgrade Remotion" })
    ).toBeNull();
  });
});
