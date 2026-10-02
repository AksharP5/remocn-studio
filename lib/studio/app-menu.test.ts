import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Effect } from "effect";
import { useCanvasLayers } from "@/hooks/use-canvas-layers";
import type { PreviewControl } from "@/hooks/use-preview";
import { installAppMenu, menuShape } from "@/lib/studio/app-menu";
import { type Command, SHORTCUTS } from "@/lib/studio/command-registry";
import { stubGlobal, unstubAllGlobals } from "@/test/stub-global";

interface Created {
  readonly handler: { onmessage: () => void } | undefined;
  readonly kind: string;
  readonly options: Record<string, unknown>;
  readonly rid: number;
}

interface Capture {
  readonly created: Created[];
  readonly installed: number[];
  readonly invoked: { command: string; payload: unknown }[];
}

function install(): Capture {
  const capture: Capture = { created: [], installed: [], invoked: [] };
  let next = 1;
  mockIPC((cmd, payload) => {
    if (cmd === "plugin:menu|new") {
      const { handler, kind, options } = payload as {
        handler: { onmessage: () => void } | undefined;
        kind: string;
        options: Record<string, unknown>;
      };
      const rid = next;
      next += 1;
      capture.created.push({ handler, kind, options, rid });
      return [rid, `id-${rid}`];
    }
    if (cmd === "plugin:menu|set_as_app_menu") {
      capture.installed.push((payload as { rid: number }).rid);
      return null;
    }
    if (cmd === "plugin:menu|close" || cmd === "plugin:resources|close") {
      return null;
    }
    if (cmd === "plugin:window|is_fullscreen") {
      return false;
    }
    if (
      cmd === "edit_webview" ||
      cmd === "plugin:window|close" ||
      cmd === "plugin:window|minimize" ||
      cmd === "plugin:window|toggle_maximize" ||
      cmd === "plugin:window|set_fullscreen"
    ) {
      capture.invoked.push({ command: cmd, payload });
      return null;
    }
    throw new Error(`unexpected command: ${cmd}`);
  });
  return capture;
}

function command(
  id: string,
  title: string,
  extra: Partial<Command> = {}
): Command {
  return {
    enabled: true,
    group: "actions",
    id,
    run: () => undefined,
    title,
    ...extra,
  };
}

const COMMANDS: readonly Command[] = [
  command("new-video", "New Video…", {
    enabled: { reason: "No project is open." },
    menu: "file",
    shortcut: SHORTCUTS["new-video"],
  }),
  command("settings", "Settings…", {
    menu: "app",
    shortcut: SHORTCUTS.settings,
  }),
  command("project-remove", "Remove from Studio…", {
    enabled: { reason: "No project is open." },
    menu: "project",
    separatorBefore: true,
  }),
  command("pane-assets", "Assets", {
    checked: true,
    menu: "view",
    shortcut: SHORTCUTS["pane-assets"],
  }),
  command("export", "Export…", { menu: "video", shortcut: SHORTCUTS.export }),
  command("chat:s1", "First cut", { group: "videos" }),
  command("project:p1", "Launch", {
    checked: true,
    group: "projects",
    menu: "file",
  }),
];

function rowsOf(capture: Capture, submenu: string): readonly Created[] {
  const owner = capture.created.find(
    (row) => row.kind === "Submenu" && row.options.text === submenu
  );
  if (owner === undefined) {
    throw new Error(`no submenu ${submenu}`);
  }
  const refs = owner.options.items as readonly [number, string][];
  return refs.map(([rid]) => {
    const found = capture.created.find((row) => row.rid === rid);
    if (found === undefined) {
      throw new Error(`no item ${rid}`);
    }
    return found;
  });
}

function texts(rows: readonly Created[]): readonly string[] {
  return rows.map((row) =>
    row.kind === "Predefined"
      ? `<${String(row.options.item)}>`
      : String(row.options.text)
  );
}

describe("installAppMenu", () => {
  let capture: Capture;

  beforeEach(() => {
    mockWindows("main");
    capture = install();
  });

  afterEach(unstubAllGlobals);

  it("builds the six submenus and installs the menu", async () => {
    await Effect.runPromise(installAppMenu(COMMANDS, mock(), () => true));

    const top = capture.created.find((row) => row.kind === "Menu");
    if (top === undefined) {
      throw new Error("no menu");
    }
    const names = (top.options.items as readonly [number, string][]).map(
      ([rid]) => capture.created.find((row) => row.rid === rid)?.options.text
    );

    expect(names).toEqual([
      "Remocn Studio",
      "File",
      "Project",
      "Edit",
      "View",
      "Video",
      "Window",
    ]);
    expect(capture.installed).toEqual([top.rid]);
  });

  it("keeps a row that does not apply, disabled, with its shortcut", () =>
    Effect.runPromise(installAppMenu(COMMANDS, mock(), () => true)).then(() => {
      const file = rowsOf(capture, "File");

      expect(texts(file)).toEqual([
        "New Video…",
        "<Separator>",
        "Launch",
        "<Separator>",
        "<CloseWindow>",
      ]);
      expect(file[0]?.options).toMatchObject({
        accelerator: "CmdOrCtrl+N",
        enabled: false,
      });
    }));

  it("checks the project and the sidebar view that are open", async () => {
    await Effect.runPromise(installAppMenu(COMMANDS, mock(), () => true));

    expect(rowsOf(capture, "File")[2]).toMatchObject({
      kind: "Check",
      options: { checked: true, text: "Launch" },
    });
    expect(rowsOf(capture, "View")[0]).toMatchObject({
      kind: "Check",
      options: { accelerator: "CmdOrCtrl+2", checked: true, text: "Assets" },
    });
    expect(texts(rowsOf(capture, "View"))).toEqual([
      "Assets",
      "<Separator>",
      "<Fullscreen>",
    ]);
  });

  it("places Settings in the application menu and Export under Video", async () => {
    await Effect.runPromise(installAppMenu(COMMANDS, mock(), () => true));

    expect(texts(rowsOf(capture, "Remocn Studio"))).toContain("Settings…");
    expect(texts(rowsOf(capture, "Video"))).toEqual(["Export…"]);
    expect(texts(rowsOf(capture, "Project"))).toEqual([
      "<Separator>",
      "Remove from Studio…",
    ]);
  });

  it("leaves a chat out of every menu", async () => {
    await Effect.runPromise(installAppMenu(COMMANDS, mock(), () => true));

    expect(
      capture.created.some((row) => row.options.text === "First cut")
    ).toBe(false);
  });

  it("routes a row's action through the runner by id", async () => {
    const run = mock();
    await Effect.runPromise(installAppMenu(COMMANDS, run, () => true));

    rowsOf(capture, "Video")[0]?.handler?.onmessage();

    expect(run).toHaveBeenCalledWith("export");
  });

  it("closes a menu that is no longer wanted instead of installing it", async () => {
    await Effect.runPromise(installAppMenu(COMMANDS, mock(), () => false));

    expect(capture.installed).toEqual([]);
  });

  it("keeps editing and window actions available on native Linux", async () => {
    stubGlobal("navigator", { userAgent: "X11; Linux x86_64" });
    await Effect.runPromise(installAppMenu(COMMANDS, mock(), () => true));

    expect(texts(rowsOf(capture, "Edit"))).toEqual([
      "Undo",
      "Redo",
      "<Separator>",
      "Cut",
      "Copy",
      "Paste",
      "Select All",
    ]);
    expect(texts(rowsOf(capture, "Window"))).toEqual(["Minimize", "Maximize"]);
    expect(texts(rowsOf(capture, "Remocn Studio"))).toContain("Quit");
    expect(texts(rowsOf(capture, "File"))).toContain("Close Window");

    for (const row of rowsOf(capture, "Edit")) {
      row.handler?.onmessage();
    }
    for (const row of rowsOf(capture, "Window")) {
      row.handler?.onmessage();
    }
    capture.created
      .find((row) => row.options.text === "Quit")
      ?.handler?.onmessage();
    capture.created
      .find((row) => row.options.text === "Toggle Fullscreen")
      ?.handler?.onmessage();

    await waitFor(() => expect(capture.invoked).toHaveLength(10));
    expect(
      capture.invoked
        .filter((row) => row.command === "edit_webview")
        .map((row) => row.payload)
    ).toEqual([
      { command: "Undo" },
      { command: "Redo" },
      { command: "Cut" },
      { command: "Copy" },
      { command: "Paste" },
      { command: "SelectAll" },
    ]);
    expect(capture.invoked).toContainEqual({
      command: "plugin:window|close",
      payload: { label: "main" },
    });
    expect(capture.invoked).toContainEqual({
      command: "plugin:window|set_fullscreen",
      payload: { label: "main", value: true },
    });
    expect(
      capture.created
        .filter((row) => row.kind === "Predefined")
        .every(
          (row) =>
            row.options.item === "Separator" ||
            typeof row.options.item === "object"
        )
    ).toBe(true);
  });

  it("routes Linux menu Undo to the focused canvas before WebKit editing", async () => {
    stubGlobal("navigator", { userAgent: "X11; Linux x86_64" });
    const viewport = document.createElement("div");
    viewport.tabIndex = 0;
    document.body.append(viewport);
    const undo = mock();
    const { unmount } = renderHook(() =>
      useCanvasLayers({
        deletion: { openRowMenu: mock(), remove: mock(), undo },
        managed: undefined,
        preview: {
          send: mock(),
          subscribe: () => () => undefined,
        } as unknown as PreviewControl,
        selection: null,
        viewport: { current: viewport },
      })
    );
    viewport.focus();
    await Effect.runPromise(installAppMenu(COMMANDS, mock(), () => true));

    act(() => rowsOf(capture, "Edit")[0]?.handler?.onmessage());

    expect(undo).toHaveBeenCalledTimes(1);
    expect(capture.invoked).toEqual([]);
    unmount();
    viewport.remove();
  });

  it("leaves Undo in a Linux text field to WebKit", async () => {
    stubGlobal("navigator", { userAgent: "X11; Linux x86_64" });
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    await Effect.runPromise(installAppMenu(COMMANDS, mock(), () => true));

    rowsOf(capture, "Edit")[0]?.handler?.onmessage();

    await waitFor(() =>
      expect(capture.invoked).toEqual([
        { command: "edit_webview", payload: { command: "Undo" } },
      ])
    );
    input.remove();
  });
});

describe("menuShape", () => {
  it("changes with a title, an enabled flag or a check, not with a run closure", () => {
    const shape = menuShape(COMMANDS);

    expect(
      menuShape(COMMANDS.map((row) => ({ ...row, run: () => undefined })))
    ).toBe(shape);
    expect(
      menuShape(
        COMMANDS.map((row) =>
          row.id === "export" ? { ...row, enabled: { reason: "x" } } : row
        )
      )
    ).not.toBe(shape);
    expect(
      menuShape(
        COMMANDS.map((row) =>
          row.id === "chat:s1" ? { ...row, title: "Second cut" } : row
        )
      )
    ).toBe(shape);
  });
});
