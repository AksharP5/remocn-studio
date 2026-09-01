import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PropsPanel } from "@/components/studio/props-pane";
import type { PendingComment } from "@/hooks/use-inspect";
import type { TuningField } from "@/lib/studio/preview";
import type { PromptElement } from "@/shared/ipc";

const ELEMENT: PromptElement = {
  column: 7,
  component: "Title",
  composition: "Main",
  file: "/Users/me/projects/my-video/src/videos/intro/index.tsx",
  fps: 30,
  frame: 42,
  html: "<h1>Hello</h1>",
  line: 12,
  scene: null,
  stack: [],
};

function field(overrides: Partial<TuningField>): TuningField {
  return {
    arrayItemType: null,
    description: null,
    group: "Parameters",
    label: "Field",
    max: null,
    maxLength: null,
    min: null,
    minLength: null,
    newItemDefault: null,
    options: [],
    path: "field",
    step: null,
    targetId: "title-1",
    type: "number",
    value: 0,
    ...overrides,
  };
}

function draw(
  fields: readonly TuningField[],
  handlers: Partial<{
    card: PendingComment;
    onCancel: () => void;
    onOpenTarget: (index: number) => void;
    onChange: (path: string, value: unknown) => void;
    onReset: (paths?: readonly string[]) => void;
    onSubmit: (comment: string) => void;
    originals: Record<string, unknown>;
    refusal: string | null;
  }> = {}
) {
  const target = { componentName: "Title", fields, targetId: "title-1" };
  const card: PendingComment = {
    element: ELEMENT,
    open: 0,
    originals: {
      "title-1": (handlers.originals ??
        Object.fromEntries(fields.map((f) => [f.path, f.value]))) as never,
    },
    rect: { height: 0.2, width: 0.4, x: 0.1, y: 0.1 },
    targets: [target],
    tuning: target,
  };

  return render(
    <PropsPanel
      card={handlers.card ?? card}
      cwd="/Users/me/projects/my-video"
      fields={fields}
      name="Title"
      onCancel={handlers.onCancel ?? vi.fn()}
      onChange={(handlers.onChange ?? vi.fn()) as never}
      onOpenTarget={handlers.onOpenTarget}
      onReset={handlers.onReset ?? vi.fn()}
      onSubmit={handlers.onSubmit ?? vi.fn()}
      refusal={handlers.refusal ?? null}
    />
  );
}

describe("PropsPanel", () => {
  it("names the component and where it came from", () => {
    draw([field({ label: "Font size", path: "size" })]);

    expect(screen.getByText("Title")).toBeDefined();
    expect(screen.getByText("src/videos/intro/index.tsx:12")).toBeDefined();
  });

  // A design tool's order: where the thing is, then how it composites, then
  // its own parameters, with timing last.
  it("orders groups the way a design tool does", () => {
    draw([
      field({ group: "Timing", label: "From", path: "from" }),
      field({ group: "Parameters", label: "Size", path: "size" }),
      field({ group: "Layer", label: "Opacity", path: "style.opacity" }),
      field({ group: "Transform", label: "Offset", path: "style.translate" }),
    ]);

    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((node) => node.textContent);

    expect(headings).toEqual(["Transform", "Layer", "Parameters", "Timing"]);
  });

  it("gives every number a typed, scrubbable field", () => {
    draw([field({ label: "Offset", path: "offset", value: 4 })]);

    expect((screen.getByLabelText("Offset") as HTMLInputElement).value).toBe(
      "4"
    );
  });

  it("renders a bounded number through DialKit with its exact range", () => {
    const { container } = draw([
      field({ label: "Blur", max: 40, min: 0, path: "blur", value: 12 }),
    ]);

    const slider = screen.getByRole("slider", { name: "Blur" });

    expect(slider.getAttribute("aria-valuemin")).toBe("0");
    expect(slider.getAttribute("aria-valuemax")).toBe("40");
    expect(slider.getAttribute("aria-valuenow")).toBe("12");
    expect(container.querySelector(".dialkit-slider-fill")).not.toBeNull();
  });

  it("leaves an unbounded number without a fill", () => {
    const { container } = draw([
      field({ label: "Offset", path: "offset", value: 4 }),
    ]);

    expect(container.querySelector("[data-fill]")).toBeNull();
  });

  it("keeps a DialKit slider adjustable from the keyboard", () => {
    const onChange = vi.fn();
    draw([field({ label: "Blur", max: 40, min: 0, path: "blur", value: 12 })], {
      onChange,
    });

    fireEvent.keyDown(screen.getByRole("slider", { name: "Blur" }), {
      key: "ArrowRight",
    });

    expect(onChange).toHaveBeenCalledWith("blur", 13);
  });

  it("splits a two-value transform into editable X and Y", () => {
    const onChange = vi.fn();
    draw(
      [
        field({
          group: "Transform",
          label: "Offset",
          path: "style.translate",
          type: "translate",
          value: "-12px 8px",
        }),
      ],
      { onChange }
    );

    expect(
      screen
        .getByRole("slider", { name: "Offset X" })
        .getAttribute("aria-valuenow")
    ).toBe("-12");
    expect(
      screen
        .getByRole("slider", { name: "Offset Y" })
        .getAttribute("aria-valuenow")
    ).toBe("8");
  });

  it("shows opacity as a percentage and stores it as a fraction", () => {
    const onChange = vi.fn();
    draw(
      [
        field({
          group: "Layer",
          label: "Opacity",
          max: 1,
          min: 0,
          path: "style.opacity",
          step: 0.01,
          value: 0.42,
        }),
      ],
      { onChange }
    );

    const opacity = screen.getByRole("slider", { name: "Opacity" });
    expect(opacity.getAttribute("aria-valuenow")).toBe("42");

    fireEvent.keyDown(opacity, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("style.opacity", 0.43);
  });

  it("reports a switch and an enum through onChange", () => {
    const onChange = vi.fn();
    draw(
      [
        field({
          label: "Hidden",
          path: "hidden",
          type: "boolean",
          value: false,
        }),
        field({
          label: "Emphasis",
          options: ["none", "glow"],
          path: "emphasis",
          type: "enum",
          value: "none",
        }),
      ],
      { onChange }
    );

    fireEvent.click(screen.getByRole("button", { name: "On" }));
    expect(onChange).toHaveBeenCalledWith("hidden", true);

    fireEvent.click(screen.getByRole("button", { name: "Emphasis None" }));
    fireEvent.click(screen.getByRole("button", { name: "Glow" }));
    expect(onChange).toHaveBeenCalledWith("emphasis", "glow");
  });

  it("offers per-row reset and Reset all only once a value moved", () => {
    const onReset = vi.fn();
    const moved = [field({ label: "Size", path: "size", value: 7 })];

    draw(moved, { onReset, originals: { size: 0 } });

    fireEvent.click(screen.getByLabelText("Reset Size"));
    expect(onReset).toHaveBeenCalledWith(["size"]);

    fireEvent.click(screen.getByText("Reset all"));
    expect(onReset).toHaveBeenCalledWith();
  });

  it("hides Reset all while nothing has moved", () => {
    draw([field({ label: "Size", path: "size" })]);

    expect(screen.queryByText("Reset all")).toBeNull();
  });

  it("counts the changes on the Add button", () => {
    draw([field({ label: "Size", path: "size", value: 7 })], {
      originals: { size: 0 },
    });

    expect(screen.getByText("Add 1")).toBeDefined();
  });

  it("holds array rows to their length constraints", () => {
    const onChange = vi.fn();
    const { container } = draw(
      [
        field({
          arrayItemType: "number",
          label: "Stops",
          maxLength: 2,
          minLength: 2,
          newItemDefault: 0,
          path: "stops",
          type: "array",
          value: [0.1, 0.4],
        }),
      ],
      { onChange }
    );

    expect(
      container
        .querySelector("[data-slot='array-items']")
        ?.classList.contains("gap-1")
    ).toBe(true);

    expect(screen.getByLabelText("Add Stops").hasAttribute("disabled")).toBe(
      true
    );
    expect(
      screen.getByLabelText("Remove Stops 1").hasAttribute("disabled")
    ).toBe(true);

    fireEvent.change(screen.getByLabelText("Stops 1"), {
      target: { value: "0.3" },
    });
    expect(onChange).toHaveBeenCalledWith("stops", [0.3, 0.4]);
  });

  it("gives an easing enum a curve and a preset picker", () => {
    const onChange = vi.fn();
    const { container } = draw(
      [
        field({
          group: "Entry",
          label: "Easing",
          options: ["linear", "ease-out"],
          path: "entry.easing",
          type: "enum",
          value: "ease-out",
        }),
      ],
      { onChange }
    );

    expect(container.querySelector(".dialkit-easing-viz path")).not.toBeNull();
    // An enum holds one of its own names, so the curve is a reading and must
    // not draw handles that cannot be dragged.
    expect(container.querySelector("[data-handle]")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Curve Ease-Out" }));
    fireEvent.click(screen.getByRole("button", { name: "Linear" }));
    expect(onChange).toHaveBeenCalledWith("entry.easing", "linear");
  });

  it("keeps a long easing label out of the constrained preset picker", () => {
    draw([
      field({
        label: "Easing used by the title slide transition",
        options: ["linear", "ease-out"],
        path: "entry.easing",
        type: "enum",
        value: "ease-out",
      }),
    ]);

    // The field label already sits beside the curve. Repeating it inside the
    // narrow select gives DialKit a max-content width that escapes the pane.
    expect(
      screen.getByRole("button", { name: "Curve Ease-Out" })
    ).toBeDefined();
  });

  it("edits a bezier easing through presets and its numbers", () => {
    const onChange = vi.fn();
    const { container } = draw(
      [
        field({
          arrayItemType: "number",
          label: "Easing",
          path: "easing",
          type: "array",
          value: [0.42, 0, 0.58, 1],
        }),
      ],
      { onChange }
    );

    expect(container.querySelector("[data-handle='1']")).not.toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Preset Ease In & Out" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Ease Out" }));
    expect(onChange).toHaveBeenCalledWith("easing", [0, 0, 0.58, 1]);

    fireEvent.change(screen.getByLabelText("Easing x1"), {
      target: { value: "0.5" },
    });
    fireEvent.blur(screen.getByLabelText("Easing x1"));
    expect(onChange).toHaveBeenCalledWith("easing", [0.5, 0, 0.58, 1]);
  });

  it("shows a colour as its hex beside a swatch", () => {
    draw([
      field({
        label: "Tint",
        path: "tint",
        type: "color",
        value: "#8b7bff",
      }),
    ]);

    expect(screen.getByText("#8B7BFF")).toBeDefined();
    expect(screen.getByTitle("Pick color")).toBeDefined();
  });

  // The picker is the native input, and it has to be the thing the pointer
  // lands on: WebKit opens no picker for a scripted click on a hidden one,
  // which is what dialkit's swatch does on its own.
  it("carries a real colour input holding the current value", () => {
    const { container } = draw([
      field({ label: "Tint", path: "tint", type: "color", value: "#8b7bff" }),
    ]);
    const picker = container.querySelector<HTMLInputElement>(
      'input[type="color"].dialkit-color-picker-native'
    );

    expect(picker?.value).toBe("#8b7bff");
  });

  it("says why the preview refused a change instead of reverting in silence", () => {
    draw([field({ label: "Size", path: "size" })], {
      refusal: "That value is not valid for this control.",
    });

    expect(
      screen.getByText("That value is not valid for this control.")
    ).toBeDefined();
  });

  it("cancels and submits from the footer", () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn();
    draw([field({ label: "Size", path: "size" })], { onCancel, onSubmit });

    fireEvent.change(
      screen.getByLabelText("What should change about this element?"),
      { target: { value: "Bigger" } }
    );
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmit).toHaveBeenCalledWith("Bigger");

    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();
  });
});

// Selecting a word lands on Remotion's markup primitive; the component that
// renders it — and carries its easing — is one level out. Merging the two was
// the first answer and it put the whole scene's camera in the pane.
describe("the Interactive chain", () => {
  const inner = {
    componentName: "<Interactive.Div>",
    fields: [field({ label: "Opacity", path: "style.opacity", value: 1 })],
    targetId: "div-1",
  };
  const outer = {
    componentName: "CameraRig",
    fields: [field({ label: "Easing", path: "easing", value: 2 })],
    targetId: "rig-1",
  };

  function chained(open: number, onOpenTarget = vi.fn()) {
    const card: PendingComment = {
      element: ELEMENT,
      open,
      originals: { "div-1": {}, "rig-1": {} },
      rect: { height: 0.2, width: 0.4, x: 0.1, y: 0.1 },
      targets: [inner, outer],
      tuning: [inner, outer][open] as never,
    };

    return {
      onOpenTarget,
      ...draw(card.tuning?.fields ?? [], { card, onOpenTarget }),
    };
  }

  it("shows only the open target's fields, and offers the rest", () => {
    chained(0);

    expect(screen.getByLabelText("Opacity")).toBeDefined();
    expect(screen.queryByLabelText("Easing")).toBeNull();
    expect(
      screen.getByRole("navigation", { name: "Which component to edit" })
    ).toBeDefined();
  });

  // `<Interactive.Div>` is Remotion's own spelling; the brackets are plumbing.
  it("names the chain the way a person reads it", () => {
    chained(0);

    expect(screen.getByRole("button", { name: "Div" })).toBeDefined();
    expect(screen.getByRole("button", { name: "CameraRig" })).toBeDefined();
  });

  it("asks to switch when an ancestor is picked", () => {
    const { onOpenTarget } = chained(0);

    fireEvent.click(screen.getByRole("button", { name: "CameraRig" }));
    expect(onOpenTarget).toHaveBeenCalledWith(1);
  });

  it("shows no switcher when there is nothing to switch to", () => {
    draw([field({ label: "Size", path: "size" })]);

    expect(
      screen.queryByRole("navigation", { name: "Which component to edit" })
    ).toBeNull();
  });
});

// Every other control is a dialkit pill with its label inside it. The easing
// editor is a canvas, a picker and four numbers, and forcing it into the row
// grid reserved a label column the pills do not have — so it sat in a narrower
// second column and the pane read as two competing alignments.
describe("the easing block's structure", () => {
  function easing() {
    return draw([
      field({
        arrayItemType: "number",
        label: "Drift easing",
        path: "easing",
        type: "array",
        value: [0, 0, 0.58, 1],
      }),
    ]);
  }

  it("stacks under one label at the pane's own edge, like the X/Y pairs", () => {
    const { container } = easing();
    const block = container.querySelector(".dialkit-composite-control");

    expect(block).not.toBeNull();
    expect(block?.querySelector(".dialkit-composite-label")?.textContent).toBe(
      "Drift easing"
    );
    expect(block?.querySelector("[data-curve]")).not.toBeNull();
  });

  it("keeps its four handles in the block, not in a column of their own", () => {
    const { container } = easing();
    const handles = container.querySelector(
      ".dialkit-composite-control .dialkit-easing-handles"
    );

    expect(
      ["x1", "y1", "x2", "y2"].map(
        (axis) =>
          handles?.querySelector(`[aria-label="Drift easing ${axis}"]`) !== null
      )
    ).toEqual([true, true, true, true]);
  });

  // The reset action shares the slot every other control puts it in.
  it("carries its action where a pill carries one", () => {
    const { container } = easing();

    expect(
      container.querySelector(
        ".dialkit-control-with-action > .dialkit-control-action"
      )
    ).not.toBeNull();
  });
});
