import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DialKitSurface } from "@/components/studio/dialkit-surface";

const theme = vi.hoisted(() => ({ resolved: "light" }));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: theme.resolved }),
}));

describe("DialKitSurface", () => {
  it("scopes DialKit and follows the resolved Studio theme", () => {
    const { container, rerender } = render(
      <DialKitSurface targetId="first">
        <span>Control</span>
      </DialKitSurface>
    );

    const surface = container.querySelector(".remocn-dialkit");
    expect(surface?.getAttribute("data-theme")).toBe("light");
    expect(surface?.getAttribute("data-target-id")).toBe("first");
    expect(container.querySelector(".dialkit-panel")).toBeNull();

    theme.resolved = "dark";
    rerender(
      <DialKitSurface targetId="second">
        <span>Control</span>
      </DialKitSurface>
    );

    expect(surface?.getAttribute("data-theme")).toBe("dark");
    expect(surface?.getAttribute("data-target-id")).toBe("second");
  });
});
