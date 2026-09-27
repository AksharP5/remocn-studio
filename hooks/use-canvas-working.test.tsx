import { afterEach, describe, expect, it } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import type { RefObject } from "react";
import type { OpenTurn } from "@/hooks/use-open-turn";
import { SELECTION_LABEL_ATTR } from "@/lib/studio/preview-camera";
import { useCanvasWorking } from "./use-canvas-working";

type Turn = Pick<OpenTurn, "isRunning" | "permission" | "source">;

const RUNNING: Turn = { isRunning: true, permission: null, source: null };
const IDLE: Turn = { isRunning: false, permission: null, source: null };

function Harness({
  overlays,
  turn,
}: {
  overlays: RefObject<HTMLElement | null>;
  turn: Turn;
}) {
  const { mark, working } = useCanvasWorking(overlays, turn);

  return working ? <span data-testid="mark" hidden ref={mark} /> : null;
}

function label(rect: DOMRect | null) {
  const node = document.createElement("div");
  node.setAttribute(SELECTION_LABEL_ATTR, "");
  move(node, rect);
  return node;
}

function move(node: HTMLElement, rect: DOMRect | null) {
  node.getBoundingClientRect = () => rect ?? new DOMRect(0, 0, 0, 0);
  node.style.left = `${rect?.left ?? 0}px`;
}

function stage(...labels: HTMLElement[]) {
  const root = document.createElement("div");
  const slot = document.createElement("div");
  slot.append(...labels);
  root.append(slot);
  document.body.append(root);
  return { current: root };
}

function drawn() {
  return screen.getByTestId("mark");
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("useCanvasWorking", () => {
  it("puts the mark just after the selection's label while a turn works", () => {
    const overlays = stage(label(new DOMRect(100, 40, 80, 18)));

    render(<Harness overlays={overlays} turn={RUNNING} />);

    expect(drawn().hidden).toBe(false);
    expect(drawn().style.left).toBe("184px");
    expect(drawn().style.top).toBe("49px");
  });

  it("follows the label when the preview moves it", async () => {
    const name = label(new DOMRect(100, 40, 80, 18));
    const overlays = stage(name);
    render(<Harness overlays={overlays} turn={RUNNING} />);

    move(name, new DOMRect(300, 200, 60, 20));

    await waitFor(() => expect(drawn().style.left).toBe("364px"));
    expect(drawn().style.top).toBe("210px");
  });

  it("is hidden while no label is shown, and appears with one", async () => {
    const name = label(null);
    const overlays = stage(name);
    render(<Harness overlays={overlays} turn={RUNNING} />);

    expect(drawn().hidden).toBe(true);

    move(name, new DOMRect(10, 10, 40, 16));

    await waitFor(() => expect(drawn().hidden).toBe(false));
    expect(drawn().style.left).toBe("54px");
  });

  it("finds a label the preview adds after the turn started", async () => {
    const overlays = stage();
    render(<Harness overlays={overlays} turn={RUNNING} />);

    overlays.current.append(label(new DOMRect(20, 30, 50, 14)));

    await waitFor(() => expect(drawn().hidden).toBe(false));
    expect(drawn().style.left).toBe("74px");
  });

  it("sits beside the size readout when that is the label shown", () => {
    const overlays = stage(label(null), label(new DOMRect(40, 300, 90, 20)));

    render(<Harness overlays={overlays} turn={RUNNING} />);

    expect(drawn().style.left).toBe("134px");
    expect(drawn().style.top).toBe("310px");
  });

  it("draws nothing when no turn is running", () => {
    const overlays = stage(label(new DOMRect(100, 40, 80, 18)));

    render(<Harness overlays={overlays} turn={IDLE} />);

    expect(screen.queryByTestId("mark")).toBeNull();
  });

  it("draws nothing while a card waits on the person", () => {
    const overlays = stage(label(new DOMRect(100, 40, 80, 18)));
    const waiting = {
      ...RUNNING,
      permission: {} as NonNullable<Turn["permission"]>,
    };

    render(<Harness overlays={overlays} turn={waiting} />);

    expect(screen.queryByTestId("mark")).toBeNull();
  });

  it("goes away when the turn ends and stops watching the label", async () => {
    const name = label(new DOMRect(100, 40, 80, 18));
    const overlays = stage(name);
    const { rerender } = render(<Harness overlays={overlays} turn={RUNNING} />);

    rerender(<Harness overlays={overlays} turn={IDLE} />);
    move(name, new DOMRect(300, 200, 60, 20));

    await waitFor(() => expect(screen.queryByTestId("mark")).toBeNull());
  });
});
