import { describe, expect, it, type Mock, mock } from "bun:test";
import { fireEvent } from "@testing-library/dom";
import { renderHook } from "@testing-library/react";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { type Command, SHORTCUTS } from "@/lib/studio/command-registry";

function command(
  id: string,
  extra: Partial<Omit<Command, "run">> = {}
): Command & { run: Mock<() => void> } {
  const run = mock(() => undefined);
  return {
    enabled: true,
    group: "actions",
    id,
    run,
    title: id,
    ...extra,
  };
}

function press(key: string, modifiers: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent("keydown", {
    cancelable: true,
    key,
    metaKey: true,
    ...modifiers,
  });
  fireEvent(window, event);
  return event;
}

describe("useShortcuts", () => {
  it("runs a page-owned command and claims the key", () => {
    const palette = command("palette", { shortcut: SHORTCUTS.palette });
    renderHook(() => useShortcuts([palette], true));

    const event = press("k");

    expect(palette.run).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves a key the registry does not know alone", () => {
    const palette = command("palette", { shortcut: SHORTCUTS.palette });
    renderHook(() => useShortcuts([palette], true));

    const event = press("z");

    expect(palette.run).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("leaves a disabled command alone", () => {
    const settings = command("settings", {
      enabled: { reason: "later" },
      shortcut: SHORTCUTS.settings,
    });
    renderHook(() => useShortcuts([settings], true));

    const event = press(",");

    expect(settings.run).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("ignores a menu-owned shortcut while the menu is installed", () => {
    const exporting = command("export", { shortcut: SHORTCUTS.export });
    renderHook(() => useShortcuts([exporting], true));

    const event = press("e");

    expect(exporting.run).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("fires a menu-owned shortcut itself when there is no menu", () => {
    const exporting = command("export", { shortcut: SHORTCUTS.export });
    renderHook(() => useShortcuts([exporting], false));

    press("e");

    expect(exporting.run).toHaveBeenCalledTimes(1);
  });

  it("opens Settings on the comma", () => {
    const settings = command("settings", { shortcut: SHORTCUTS.settings });
    renderHook(() => useShortcuts([settings], true));

    press(",");

    expect(settings.run).toHaveBeenCalledTimes(1);
  });

  it("reads the newest registry without re-subscribing", () => {
    const first = command("export", { shortcut: SHORTCUTS.export });
    const second = command("export", { shortcut: SHORTCUTS.export });
    const view = renderHook(
      ({ commands }: { commands: readonly Command[] }) =>
        useShortcuts(commands, false),
      { initialProps: { commands: [first] } }
    );

    view.rerender({ commands: [second] });
    press("e");

    expect(first.run).not.toHaveBeenCalled();
    expect(second.run).toHaveBeenCalledTimes(1);
  });
});
