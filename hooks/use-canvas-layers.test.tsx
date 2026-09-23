import { afterEach, describe, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import type { MouseEvent } from "react";
import type { PreviewControl, PreviewListener } from "@/hooks/use-preview";
import type { PreviewMessage } from "@/lib/studio/preview";
import type { StudioObject } from "@/shared/studio-document";
import { useCanvasLayers } from "./use-canvas-layers";

function object(id: string, parentId: string | null = null): StudioObject {
  return { definition: "box", id, label: id, parentId, values: {} };
}

const OBJECTS = [
  object("hero"),
  object("title", "hero"),
  object("card"),
  object("price", "card"),
];

function setup(selected: string | null = null, objects = OBJECTS) {
  const listeners = new Set<PreviewListener>();
  const send = mock();
  const select = mock();
  const preview = {
    send,
    subscribe: (listener: PreviewListener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  } as unknown as PreviewControl;
  const viewport = document.createElement("div");
  viewport.tabIndex = 0;
  document.body.append(viewport);
  const managed = (id: string | null) => ({
    enabled: true,
    error: null,
    isOpen: id !== null,
    loading: false,
    objects,
    select,
    selected: objects.find((item) => item.id === id) ?? null,
  });
  const hook = renderHook(
    ({ picked, selection }: { picked?: string | null; selection: unknown }) =>
      useCanvasLayers({
        managed: managed(picked === undefined ? selected : picked),
        preview,
        selection,
        viewport: { current: viewport },
      }),
    {
      initialProps: { selection: selected } as {
        picked?: string | null;
        selection: unknown;
      },
    }
  );
  const emit = (message: PreviewMessage) =>
    act(() => {
      for (const listener of listeners) {
        listener(message);
      }
    });
  const press = (init: KeyboardEventInit, target: Element = viewport) => {
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Tab",
      ...init,
    });
    target.dispatchEvent(event);
    return event;
  };
  return { ...hook, emit, press, select, send, viewport };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("useCanvasLayers", () => {
  it("lists the objects as a tree", () => {
    const { result } = setup();

    expect(result.current.rows.map((row) => `${row.depth}:${row.id}`)).toEqual([
      "0:hero",
      "1:title",
      "0:card",
      "1:price",
    ]);
  });

  it("treats every object as on screen until the runtime says", () => {
    const { result } = setup();

    expect(result.current.rows.every(result.current.isPresent)).toBe(true);
  });

  it("dims what the runtime has not mounted, and forgets it on a rebuild", () => {
    const { emit, result } = setup();
    emit({ ids: ["title"], source: "remocn-preview", type: "studio.present" });

    expect(
      result.current.rows.filter(result.current.isPresent).map((row) => row.id)
    ).toEqual(["title"]);

    emit({ source: "remocn-preview", type: "rebuilt" });

    expect(result.current.rows.every(result.current.isPresent)).toBe(true);
  });

  it("asks the runtime to outline a hovered row and to stop", () => {
    const { result, send } = setup();
    act(() => result.current.hover("card"));
    act(() => result.current.hover(null));

    expect(send.mock.calls.map(([command]) => command.objectId)).toEqual([
      "card",
      null,
    ]);
  });

  it("selects a row the way a click on the canvas does", () => {
    const { result, select, send } = setup();
    act(() => result.current.select("price"));

    expect(select).toHaveBeenCalledWith("price");
    expect(send).toHaveBeenLastCalledWith(
      expect.objectContaining({ objectId: null, type: "studio.hover" })
    );
  });

  it("tabs through the objects on screen in list order", () => {
    const { emit, press, select } = setup("title");
    emit({
      ids: ["title", "card"],
      source: "remocn-preview",
      type: "studio.present",
    });

    const event = press({});

    expect(event.defaultPrevented).toBe(true);
    expect(select).toHaveBeenLastCalledWith("card");

    press({ shiftKey: true });

    expect(select).toHaveBeenLastCalledWith("card");
  });

  it("starts with the first object when nothing is selected", () => {
    const { press, select } = setup();
    press({});

    expect(select).toHaveBeenLastCalledWith("hero");
  });

  it("leaves Tab alone while text is being edited", () => {
    const { press, select, viewport } = setup();
    viewport.setAttribute("data-preview-editing", "");

    expect(press({}).defaultPrevented).toBe(false);
    expect(select).not.toHaveBeenCalled();
  });

  it("leaves Tab alone when nothing is on screen", () => {
    const { emit, press, select } = setup();
    emit({ ids: [], source: "remocn-preview", type: "studio.present" });

    expect(press({}).defaultPrevented).toBe(false);
    expect(select).not.toHaveBeenCalled();
  });

  it("leaves Tab to a control inside the canvas", () => {
    const { press, select, viewport } = setup();
    const button = document.createElement("button");
    viewport.append(button);

    expect(press({}, button).defaultPrevented).toBe(false);
    expect(select).not.toHaveBeenCalled();
  });

  it("shows the list while nothing is selected", () => {
    const { result } = setup();

    expect(result.current.view).toBe("layers");
  });

  it("shows the properties of a new selection", () => {
    const { rerender, result } = setup();
    rerender({ selection: "object:title" });

    expect(result.current.view).toBe("properties");
  });

  it("goes back to the list without dropping the selection", () => {
    const { rerender, result } = setup("title");
    rerender({ selection: "object:title" });
    act(() => result.current.choose("layers"));

    expect(result.current.view).toBe("layers");
    expect(result.current.selectedId).toBe("title");
  });

  it("shows properties again when a row is picked from the list", () => {
    const { rerender, result, select } = setup("title");
    rerender({ selection: "object:title" });
    act(() => result.current.choose("layers"));
    act(() => result.current.select("title"));

    expect(select).toHaveBeenCalledWith("title");
    expect(result.current.view).toBe("properties");
  });

  it("shows properties when the canvas picks something else", () => {
    const { rerender, result } = setup("title");
    rerender({ selection: "object:title" });
    act(() => result.current.choose("layers"));
    rerender({ selection: { element: "a heading" } });

    expect(result.current.view).toBe("properties");
  });

  it("forgets the choice once the selection is dropped", () => {
    const { rerender, result } = setup("title");
    rerender({ selection: "object:title" });
    act(() => result.current.choose("layers"));
    rerender({ selection: null });
    rerender({ selection: "object:title" });

    expect(result.current.view).toBe("properties");
  });

  function clickView(value: string) {
    return { currentTarget: { value } } as MouseEvent<HTMLButtonElement>;
  }

  it("starts expanded on the list", () => {
    const { result } = setup();

    expect(result.current.shown).toBe(true);
    expect(result.current.active).toBe("layers");
  });

  it("collapses when the active view's icon is clicked, and expands on any", () => {
    const { rerender, result } = setup("title");
    rerender({ selection: "object:title" });
    act(() => result.current.onView(clickView("properties")));

    expect(result.current.shown).toBe(false);
    expect(result.current.active).toBeNull();

    act(() => result.current.onView(clickView("layers")));

    expect(result.current.shown).toBe(true);
    expect(result.current.active).toBe("layers");
  });

  it("switches views without collapsing", () => {
    const { rerender, result } = setup("title");
    rerender({ selection: "object:title" });
    act(() => result.current.onView(clickView("layers")));

    expect(result.current.shown).toBe(true);
    expect(result.current.active).toBe("layers");
    expect(result.current.selectedId).toBe("title");
  });

  it("collapses and expands from its own control", () => {
    const { result } = setup();
    act(() => result.current.toggle());

    expect(result.current.shown).toBe(false);

    act(() => result.current.toggle());

    expect(result.current.shown).toBe(true);
  });

  function toggleRow(value: string) {
    return { currentTarget: { value } } as MouseEvent<HTMLButtonElement>;
  }

  const visibleIds = (result: { current: { visible: { id: string }[] } }) =>
    result.current.visible.map((row) => row.id);

  it("opens the group on screen and closes the rest", () => {
    const { emit, result } = setup();
    emit({ ids: ["title"], source: "remocn-preview", type: "studio.present" });

    expect(visibleIds(result)).toEqual(["hero", "title", "card"]);
  });

  it("keeps a group the person collapsed closed as the playhead moves", () => {
    const { emit, result } = setup();
    emit({ ids: ["title"], source: "remocn-preview", type: "studio.present" });
    act(() => result.current.onToggle(toggleRow("hero")));
    emit({
      ids: ["title", "price"],
      source: "remocn-preview",
      type: "studio.present",
    });

    expect(visibleIds(result)).toEqual(["hero", "card", "price"]);
  });

  it("opens the groups above an object selected on the canvas", () => {
    const { emit, rerender, result } = setup();
    emit({ ids: ["title"], source: "remocn-preview", type: "studio.present" });
    act(() => result.current.onToggle(toggleRow("hero")));

    expect(visibleIds(result)).not.toContain("title");

    rerender({ picked: "title", selection: "object:title" });

    expect(visibleIds(result)).toContain("title");
  });

  it("marks scene objects as scenes", () => {
    const { result } = setup(null, [
      {
        definition: "scene",
        id: "phone",
        label: "Phone",
        parentId: null,
        values: {},
      },
      {
        definition: "box",
        id: "clock",
        label: "Clock",
        parentId: "phone",
        values: {},
      },
    ]);

    expect(result.current.rows.map((row) => row.isScene)).toEqual([
      true,
      false,
    ]);
  });
});
