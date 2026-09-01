import { render, screen } from "@testing-library/react";
import {
  ColorControl,
  EasingVisualization,
  SelectControl,
  Slider,
  TextControl,
  Toggle,
} from "dialkit";
import { describe, expect, it, vi } from "vitest";

describe("DialKit advanced controls", () => {
  it("renders as controlled React 19 components without DialRoot", () => {
    render(
      <div className="dialkit-root" data-theme="dark">
        <Slider
          label="Opacity"
          max={100}
          min={0}
          onChange={vi.fn()}
          step={1}
          unit="%"
          value={42}
        />
        <Toggle checked label="Visible" onChange={vi.fn()} />
        <ColorControl label="Fill" onChange={vi.fn()} value="#ff5500" />
        <SelectControl
          label="Layout"
          onChange={vi.fn()}
          options={["stack", "grid"]}
          value="stack"
        />
        <TextControl label="Title" onChange={vi.fn()} value="Hello" />
        <EasingVisualization
          easing={{
            duration: 0.6,
            ease: [0.22, 1, 0.36, 1],
            type: "easing",
          }}
        />
      </div>
    );

    expect(screen.getByText("Opacity")).toBeDefined();
    expect(screen.getByText("Visible")).toBeDefined();
    expect(screen.getByText("Fill")).toBeDefined();
    expect(screen.getByText("Layout")).toBeDefined();
    expect(screen.getByDisplayValue("Hello")).toBeDefined();
    expect(document.querySelector(".dialkit-easing-viz")).not.toBeNull();
    expect(document.querySelector(".dialkit-panel")).toBeNull();
  });
});
