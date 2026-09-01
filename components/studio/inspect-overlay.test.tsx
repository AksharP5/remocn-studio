import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InspectOverlay } from "@/components/studio/inspect-overlay";
import type { PendingComment } from "@/hooks/use-inspect";
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

const RECT = { height: 0.2, width: 0.4, x: 0.1, y: 0.1 };

const PLAIN: PendingComment = {
  element: ELEMENT,
  open: 0,
  originals: {},
  rect: RECT,
  targets: [],
  tuning: null,
};

const TITLE = { componentName: "Title", fields: [], targetId: "title-1" };

const TUNABLE: PendingComment = {
  ...PLAIN,
  targets: [TITLE],
  tuning: TITLE,
};

function draw(card: PendingComment | null, handlers = {}) {
  return render(
    <InspectOverlay
      card={card}
      cwd="/Users/me/projects/my-video"
      markers={[]}
      onCancel={vi.fn()}
      onSubmit={vi.fn()}
      {...handlers}
    />
  );
}

describe("InspectOverlay", () => {
  it("answers an element with no schema with the compact card", () => {
    draw(PLAIN);

    expect(screen.getByText("Title")).toBeDefined();
    expect(
      screen.getByLabelText("What should change about this element?")
    ).toBeDefined();
  });

  // A tunable element is answered by the properties pane, which has the room
  // the card never had; two surfaces for one selection is the thing to avoid.
  it("leaves a tunable element to the properties pane", () => {
    draw(TUNABLE);

    expect(
      screen.queryByLabelText("What should change about this element?")
    ).toBeNull();
  });

  it("submits the comment with Add", () => {
    const onSubmit = vi.fn();
    draw(PLAIN, { onSubmit });

    fireEvent.change(
      screen.getByLabelText("What should change about this element?"),
      { target: { value: "Larger" } }
    );
    fireEvent.click(screen.getByText("Add", { selector: "button" }));

    expect(onSubmit).toHaveBeenCalledWith("Larger");
  });

  it("draws a numbered marker per kept selection", () => {
    render(
      <InspectOverlay
        card={null}
        cwd={null}
        markers={[{ id: "a", index: 0, rect: RECT }]}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText("1")).toBeDefined();
  });
});
