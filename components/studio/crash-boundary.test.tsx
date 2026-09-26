import { describe, expect, it, spyOn } from "bun:test";
import { render, screen } from "@testing-library/react";
import { CrashBoundary } from "@/components/studio/crash-boundary";

function Broken(): never {
  throw new Error("the render broke");
}

describe("CrashBoundary", () => {
  it("replaces a render that throws with the screen that offers a reload", () => {
    const quiet = spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <CrashBoundary>
        <Broken />
      </CrashBoundary>
    );

    expect(
      screen.getByRole("heading", { name: "The studio stopped drawing" })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Reload the window" })
    ).toBeVisible();
    quiet.mockRestore();
  });

  it("draws its children when nothing throws", () => {
    render(
      <CrashBoundary>
        <p>All well</p>
      </CrashBoundary>
    );

    expect(screen.getByText("All well")).toBeVisible();
  });
});
