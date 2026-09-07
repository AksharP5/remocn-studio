import { readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  ColorControl,
  DialPad,
  EasingVisualization,
  ImageControl,
  SelectControl,
  Slider,
  SpringVisualization,
  TextControl,
  Toggle,
} from "dialkit";
import { describe, expect, it, vi } from "vitest";

// dialkit ships no changelog, in npm or in GitHub Releases, so what a version
// gives us is read out of its `dist` and pinned here. Everything below is
// something the pane stopped doing for itself at 2.0.
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

  // 2.0 carries the role, the tab stop, the aria values and the keyboard
  // itself. The pane's own `AccessibleDialSlider` wrapper added all four and
  // is gone; a slider inside a slider is what keeping it would have meant.
  it("is the slider itself, keyboard and all", () => {
    const onChange = vi.fn();
    const { container } = render(
      <Slider
        label="Blur"
        max={40}
        min={0}
        onChange={onChange}
        step={1}
        value={12}
      />
    );

    const slider = screen.getByRole("slider", { name: "Blur" });

    expect(slider.classList.contains("dialkit-slider")).toBe(true);
    expect(slider.getAttribute("tabindex")).toBe("0");
    expect(slider.getAttribute("aria-valuemin")).toBe("0");
    expect(slider.getAttribute("aria-valuemax")).toBe("40");
    expect(slider.getAttribute("aria-valuenow")).toBe("12");
    expect(container.querySelectorAll("[role='slider']").length).toBe(1);

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyDown(slider, { key: "End" });
    expect(onChange.mock.calls).toEqual([[13], [40]]);
  });

  // The pane drew its own SVG, its own handles and its own drag hook for this.
  it("edits its own bezier handles once given an onChange", () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <EasingVisualization
        easing={{ duration: 1, ease: [0.42, 0, 0.58, 1], type: "easing" }}
        onChange={onChange}
      />
    );

    const handles = [
      ...container.querySelectorAll<HTMLButtonElement>(
        ".dialkit-easing-handle"
      ),
    ];

    expect(handles.length).toBe(2);
    expect(handles.map((handle) => handle.disabled)).toEqual([false, false]);

    fireEvent.keyDown(handles[0] as HTMLButtonElement, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith([0.43, 0, 0.58, 1]);

    // No onChange is how the pane says "this value cannot be dragged" — an
    // enum holds one of its own names and nothing else.
    rerender(
      <EasingVisualization
        easing={{ duration: 1, ease: [0.42, 0, 0.58, 1], type: "easing" }}
      />
    );
    expect(
      [
        ...container.querySelectorAll<HTMLButtonElement>(
          ".dialkit-easing-handle"
        ),
      ].map((handle) => handle.disabled)
    ).toEqual([true, true]);
  });

  // `colorValue()` used to flatten anything that was not a hex to #000000,
  // because 1.4.3 only read hex. 2.0 parses rgb, hsl, oklch and Display P3.
  it("keeps a colour that is not a hex", () => {
    render(
      <ColorControl
        label="Tint"
        onChange={vi.fn()}
        value="oklch(0.72 0.19 45)"
      />
    );

    expect(
      (screen.getByLabelText("Tint color value") as HTMLInputElement).value
    ).toBe("oklch(0.72 0.19 45)");
    expect(
      screen.getByRole("button", { name: "Pick tint color" })
    ).toBeDefined();
  });

  // The picker is dialkit's own popover now, opened from a real button. The
  // pane used to lay a native `<input type="color">` over the swatch, because
  // WebKit opens nothing for the scripted click 1.4.3 made. Whether the
  // popover then lands inside the 340px pane is the running app's answer:
  // dialkit positions it against `getClientRects()`, which jsdom leaves empty,
  // so an opened popover closes itself here on the first measurement.
  it("opens its picker from a real button, with no native colour input", () => {
    const { container } = render(
      <div className="dialkit-root">
        <ColorControl label="Tint" onChange={vi.fn()} value="#8b7bff" />
      </div>
    );

    const swatch = screen.getByRole("button", { name: "Pick tint color" });

    expect(container.querySelector('input[type="color"]')).toBeNull();
    expect(swatch.getAttribute("aria-haspopup")).toBe("dialog");
    expect(swatch.classList.contains("dialkit-color-swatch")).toBe(true);
  });

  // The pad is what a pair of numbers is edited on now. Its axes take the
  // slider's own `[default, min, max, step]`, its Y grows upward, and it
  // carries a spinbutton per axis — which is the half of it jsdom can drive,
  // the plane itself being measured with `getBoundingClientRect`.
  it("is two spinbuttons over one plane, with Y the way up a pad has it", () => {
    const onChange = vi.fn();
    const { container } = render(
      <DialPad
        label="Offset"
        onChange={onChange}
        value={{ x: 12, y: -40 }}
        x={[0, -100, 100, 1]}
        y={[0, -120, 120, 1]}
      />
    );

    const y = screen.getByLabelText("Offset Y") as HTMLInputElement;

    expect(container.querySelector(".dialkit-pad-plane")).not.toBeNull();
    expect(y.value).toBe("-40");
    expect(y.getAttribute("aria-valuemin")).toBe("-120");

    fireEvent.keyDown(y, { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith({ x: 12, y: -39 });
  });

  // The picture control the `asset` field type needed. Its options are the
  // `src` it draws, so a value and an option are URLs; and its picker is a
  // popover that closes itself under jsdom, as the colour one does.
  it("draws the value it is given and names it from the options", () => {
    const { container } = render(
      <ImageControl
        label="Source"
        onChange={vi.fn()}
        options={[{ label: "bg.png", value: "https://host/static/bg.png" }]}
        value="https://host/static/bg.png"
      />
    );

    expect(screen.getByText("bg.png")).toBeDefined();
    expect(
      container.querySelector<HTMLImageElement>(".dialkit-image-img")?.src
    ).toBe("https://host/static/bg.png");
  });

  // dialkit's upload reads a file into a data URL and hands it to `onChange`;
  // there is no seam to send it anywhere else, and a data URL is the one value
  // the studio must not write into somebody's TSX. So the button is hidden in
  // CSS, and this is what says a version bump has not moved the class.
  it("uploads by data URL, which is why the pane hides that button", () => {
    const source = readFileSync(
      "node_modules/dialkit/dist/image-control.js",
      "utf8"
    );

    expect(source).toContain("readAsDataURL");
    expect(source).toContain("dialkit-button dialkit-image-upload");
    expect(readFileSync("app/globals.css", "utf8")).toContain(
      ".remocn-dialkit .dialkit-image-upload {\n  display: none;\n}"
    );
  });

  // Physics only. Time mode parameterises Motion's own solver, which Remotion
  // does not use, and the full `SpringControl` needs a registered panel.
  it("plots a spring from damping, stiffness and mass alone", () => {
    const { container } = render(
      <SpringVisualization
        isSimpleMode={false}
        spring={{ damping: 20, mass: 1, stiffness: 180, type: "spring" }}
      />
    );

    const curve = container.querySelector(".dialkit-spring-viz path");

    expect(curve?.getAttribute("d")?.startsWith("M 0")).toBe(true);
  });

  // A `text-content` field is written back into the person's TSX, so it has to
  // carry VERBATIM_INPUT — and 2.0's TextControl passes nothing through to its
  // textarea. That is why the pane still draws its own for that one field.
  it("forwards no attributes to its textarea", () => {
    render(<TextControl label="Title" onChange={vi.fn()} value="Hello" />);

    const textarea = screen.getByDisplayValue("Hello");

    expect(textarea.hasAttribute("autocorrect")).toBe(false);
    expect(textarea.hasAttribute("autocapitalize")).toBe(false);
  });
});
