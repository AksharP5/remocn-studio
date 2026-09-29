import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
  mock,
} from "bun:test";
import { act, renderHook } from "@testing-library/react";
import type { PointerEvent } from "react";
import { useSidebarPeek } from "@/hooks/use-sidebar-peek";

function leave(clientX: number) {
  return { clientX } as PointerEvent<HTMLElement>;
}

function mounted(isPeeking = false) {
  const peek = mock();
  const view = renderHook(
    ({ open }: { open: boolean }) => useSidebarPeek(open, peek),
    { initialProps: { open: isPeeking } }
  );
  return { peek, view };
}

describe("useSidebarPeek", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("opens when the pointer rests on the edge", () => {
    const { peek, view } = mounted();

    act(() => view.result.current.onEdgeEnter());
    act(() => jest.advanceTimersByTime(100));

    expect(peek).toHaveBeenCalledWith(true);
  });

  it("does not open for a pointer passing over the edge", () => {
    const { peek, view } = mounted();

    act(() => view.result.current.onEdgeEnter());
    act(() => view.result.current.onEdgeLeave());
    act(() => jest.advanceTimersByTime(100));

    expect(peek).not.toHaveBeenCalled();
  });

  it("closes when the pointer leaves to the right, and not back over the edge", () => {
    const { peek, view } = mounted(true);

    act(() => view.result.current.onPanelLeave(leave(4)));
    act(() => jest.advanceTimersByTime(300));
    expect(peek).not.toHaveBeenCalled();

    act(() => view.result.current.onPanelLeave(leave(300)));
    act(() => jest.advanceTimersByTime(300));
    expect(peek).toHaveBeenCalledWith(false);
  });

  it("stays open when the pointer comes back in time", () => {
    const { peek, view } = mounted(true);

    act(() => view.result.current.onPanelLeave(leave(300)));
    act(() => view.result.current.onPanelEnter());
    act(() => jest.advanceTimersByTime(300));

    expect(peek).not.toHaveBeenCalled();
  });

  it("closes on a press outside it, not inside it", () => {
    const { peek, view } = mounted(true);

    act(() => {
      view.result.current.onPanelPointerDown();
      document.dispatchEvent(new Event("pointerdown"));
    });
    expect(peek).not.toHaveBeenCalled();

    act(() => {
      document.dispatchEvent(new Event("pointerdown"));
    });
    expect(peek).toHaveBeenCalledWith(false);
  });

  it("closes on Escape", () => {
    const { peek } = mounted(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(peek).toHaveBeenCalledWith(false);
  });
});
