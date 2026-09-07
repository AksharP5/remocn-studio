import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  type AssetOptions,
  TuningRow,
} from "@/components/studio/tuning-controls";
import type { TuningField } from "@/lib/studio/preview";

const RESET = /Reset/;
const CHOOSE_SOURCE = /Choose source image/;

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
    assets?: AssetOptions;
    fonts?: readonly string[];
    onChange?: (path: string, value: unknown) => void;
    original?: TuningField["value"];
  } = {}
) {
  return render(
    <TuningRow
      assets={options.assets}
      duration={1}
      field={shown}
      fonts={options.fonts}
      onChange={(options.onChange ?? vi.fn()) as never}
      onReset={vi.fn()}
      original={options.original ?? shown.value}
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

describe("a pair of numbers", () => {
  it("is one pad, and its Y reads the other way up from the CSS", () => {
    const onChange = vi.fn();
    const { container } = draw(
      field({
        label: "Offset",
        path: "style.translate",
        type: "translate",
        value: "12px 40px",
      }),
      { onChange }
    );

    expect(container.querySelector(".dialkit-pad")).not.toBeNull();
    expect(container.querySelectorAll("[role='slider']").length).toBe(0);

    const y = screen.getByLabelText("Offset Y") as HTMLInputElement;

    expect(y.value).toBe("-40");

    // Up on the pad is up on the frame, which is *less* downward translation.
    fireEvent.keyDown(y, { key: "ArrowUp" });

    expect(onChange).toHaveBeenCalledWith("style.translate", "12px 39px");
  });

  it("keeps a scale pair on its two sliders", () => {
    const { container } = draw(
      field({
        label: "Scale",
        path: "style.scale",
        type: "scale",
        value: "1 1",
      })
    );

    expect(container.querySelector(".dialkit-pad")).toBeNull();
    expect(container.querySelectorAll("[role='slider']").length).toBe(2);
  });
});

describe("the asset control", () => {
  const BASE = "http://127.0.0.1:5173/static-abc/";

  function drawAsset(
    value: string,
    onChange?: (path: string, next: unknown) => void
  ) {
    return draw(
      field({
        group: "Fill",
        label: "Source",
        path: "src",
        type: "asset",
        value,
      }),
      {
        assets: { base: BASE, names: ["bg.png", "library/logo.png"] },
        onChange,
      }
    );
  }

  it("names the picture the element is holding", () => {
    const { container } = drawAsset("library/logo.png");

    expect(container.querySelector(".dialkit-image-control")).not.toBeNull();
    expect(screen.getByText("library/logo.png")).toBeDefined();
    expect(
      container.querySelector<HTMLImageElement>(".dialkit-image-img")?.src
    ).toBe(`${BASE}library/logo.png`);
  });

  // The picker itself is a popover, and dialkit closes it on its first
  // measurement under jsdom — `getClientRects()` is empty there, exactly as
  // the colour picker's is. What the pane owes the person before it opens is
  // the name of what is on screen now.
  it("is a picker, and says so", () => {
    drawAsset("bg.png");

    const trigger = screen.getByRole("button", { name: CHOOSE_SOURCE });

    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("shows the value's own name when the project does not have the file", () => {
    drawAsset("https://example.com/remote.png");

    expect(screen.getByText("remote.png")).toBeDefined();
  });
});
