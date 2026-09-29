import { describe, expect, it } from "bun:test";
import { renderHook } from "@testing-library/react";
import { useSidebarCollapse } from "@/hooks/use-sidebar-collapse";

function mounted(isShown: boolean, hasRoom = true) {
  return renderHook(
    (props: { hasRoom: boolean; isShown: boolean }) =>
      useSidebarCollapse(props.isShown, props.hasRoom),
    { initialProps: { hasRoom, isShown } }
  );
}

describe("useSidebarCollapse", () => {
  it("slides when the person hides it", () => {
    const view = mounted(true);
    view.rerender({ hasRoom: true, isShown: false });

    expect(view.result.current.isAnimating).toBe(true);
    expect(view.result.current.isMounted).toBe(true);
  });

  it("folds at once when the window loses the room for it", () => {
    const view = mounted(true);
    view.rerender({ hasRoom: false, isShown: false });

    expect(view.result.current.isAnimating).toBe(false);
    expect(view.result.current.isMounted).toBe(false);

    view.rerender({ hasRoom: true, isShown: true });

    expect(view.result.current.isAnimating).toBe(false);
    expect(view.result.current.isExpanded).toBe(true);
  });
});
