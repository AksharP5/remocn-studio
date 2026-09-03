import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TuningRow } from "@/components/studio/tuning-controls";
import type { TuningField } from "@/lib/studio/preview";

const RESET = /Reset/;

function field(overrides: Partial<TuningField>): TuningField {
  return {
    arrayItemType: null,
    description: null,
    group: "Typography",
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
  shown: TuningField,
  options: {
    fonts?: readonly string[];
    onChange?: (path: string, value: unknown) => void;
  } = {}
) {
  return render(
    <TuningRow
      field={shown}
      fonts={options.fonts}
      onChange={(options.onChange ?? vi.fn()) as never}
      onReset={vi.fn()}
      original={shown.value}
      refusal={null}
    />
  );
}

describe("the text control", () => {
  it("sends what was typed to the path the field owns", () => {
    const onChange = vi.fn();
    draw(
      field({
        label: "Text",
        path: "children",
        type: "text-content",
        value: "Ship it",
      }),
      { onChange }
    );

    fireEvent.change(screen.getByLabelText("Text"), {
      target: { value: "Ship it today" },
    });

    expect(onChange).toHaveBeenCalledWith("children", "Ship it today");
  });

  it("offers the families the page has loaded", () => {
    const { container } = draw(
      field({
        label: "Font family",
        path: "style.fontFamily",
        type: "font-family",
        value: "Geist",
      }),
      { fonts: ["Geist", "Inter"] }
    );
    const input = screen.getByLabelText("Font family");

    expect(input.getAttribute("list")).toBe(
      container.querySelector("datalist")?.id
    );
    expect(
      [...container.querySelectorAll("datalist option")].map(
        (option) => (option as HTMLOptionElement).value
      )
    ).toEqual(["Geist", "Inter"]);
  });

  it("sends the family that was typed over the suggestions", () => {
    const onChange = vi.fn();
    draw(
      field({
        label: "Font family",
        path: "style.fontFamily",
        type: "font-family",
        value: "Geist",
      }),
      { fonts: ["Geist"], onChange }
    );

    fireEvent.change(screen.getByLabelText("Font family"), {
      target: { value: "Inter" },
    });

    expect(onChange).toHaveBeenCalledWith("style.fontFamily", "Inter");
  });
});

describe("a value the pane may show and may not edit", () => {
  it("renders the value with no control at all", () => {
    draw(
      field({
        label: "Letter spacing",
        path: "style.letterSpacing",
        readOnly: true,
        type: "text-content",
        value: "-0.03em",
      })
    );

    expect(screen.getByText("-0.03em")).toBeDefined();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("slider")).toBeNull();
  });

  it("says why under the row, and offers no reset", () => {
    draw(
      field({
        description: "Text is built from parts — ask in words",
        label: "Children",
        path: "children",
        readOnly: true,
        type: "text-content",
        value: "",
      })
    );

    expect(
      screen.getByText("Text is built from parts — ask in words")
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: RESET })).toBeNull();
  });
});
