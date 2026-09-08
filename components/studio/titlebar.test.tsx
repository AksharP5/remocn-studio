import { describe, expect, it, mock } from "bun:test";
import { render } from "@testing-library/react";
import { Titlebar } from "@/components/studio/titlebar";

mock.module("@/components/studio/shader-field", () => ({
  ShaderField: () => <div data-testid="shader" />,
}));

const MOOD = { isBusy: false, tone: "idle" } as const;

describe("Titlebar", () => {
  it("does not replay a boot entrance after the splash leaves", () => {
    const rendered = render(<Titlebar isBooting mood={MOOD} />);
    const field = rendered.container.querySelector(
      '[data-slot="titlebar-mood"]'
    );

    expect(field).not.toHaveClass("animate-titlebar");

    rendered.rerender(<Titlebar isBooting={false} mood={MOOD} />);
    expect(field).not.toHaveClass("animate-titlebar");
  });

  it("keeps the entrance for a mood first shown after boot", () => {
    const { container } = render(<Titlebar mood={MOOD} />);

    expect(container.querySelector('[data-slot="titlebar-mood"]')).toHaveClass(
      "animate-titlebar"
    );
  });
});
