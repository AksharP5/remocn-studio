import { describe, expect, it } from "bun:test";
import {
  acceleratorOf,
  type Command,
  duplicateShortcuts,
  findByShortcut,
  formatShortcut,
  HOTKEY_GROUPS,
  matchCommands,
  ownerOf,
  SHORTCUT_IDS,
  SHORTCUT_TITLES,
  SHORTCUTS,
  shortcutKeys,
  shortcutOf,
} from "@/lib/studio/command-registry";

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

function key(
  value: string,
  modifiers: Partial<{
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
  }> = {}
) {
  return {
    altKey: false,
    ctrlKey: false,
    key: value,
    metaKey: true,
    shiftKey: false,
    ...modifiers,
  };
}

describe("matchCommands", () => {
  const commands = [
    command("intro", "Intro"),
    command("interview", "Interview"),
    command("outro", "Outro", { detail: "Intro" }),
    command("accent", "Résumé"),
  ];

  it("keeps the source order and matches every word", () => {
    expect(matchCommands("int", commands).map((row) => row.id)).toEqual([
      "intro",
      "interview",
      "outro",
    ]);
    expect(matchCommands("in view", commands).map((row) => row.id)).toEqual([
      "interview",
    ]);
  });

  it("ignores case and accents", () => {
    expect(matchCommands("RESUME", commands).map((row) => row.id)).toEqual([
      "accent",
    ]);
    expect(matchCommands("résumé", commands).map((row) => row.id)).toEqual([
      "accent",
    ]);
  });

  it("returns everything for an empty query", () => {
    expect(matchCommands("   ", commands)).toBe(commands);
  });

  it("matches the detail as well as the title", () => {
    expect(matchCommands("outro intro", commands).map((row) => row.id)).toEqual(
      ["outro"]
    );
  });
});

describe("the shortcut table", () => {
  it("names every shortcut once with one owner", () => {
    const commands = SHORTCUT_IDS.map((id) =>
      command(id, id, { shortcut: SHORTCUTS[id] })
    );

    expect(duplicateShortcuts(commands)).toEqual([]);
    for (const id of SHORTCUT_IDS) {
      expect(["menu", "page"]).toContain(ownerOf(id));
    }
    expect(ownerOf("video:1")).toBeNull();
  });

  it("lists every shortcut once in the Hotkeys groups, with a title", () => {
    const listed = HOTKEY_GROUPS.flatMap((group) => group.ids);

    expect([...listed].sort()).toEqual([...SHORTCUT_IDS].sort());
    for (const id of listed) {
      expect(SHORTCUT_TITLES[id].length).toBeGreaterThan(0);
    }
  });

  it("reports a clash by label and by id", () => {
    const clash = [
      command("a", "A", { shortcut: { key: "e" } }),
      command("b", "B", { shortcut: { key: "e" } }),
    ];

    expect(duplicateShortcuts(clash)).toEqual(["⌘E: a and b"]);
  });
});

describe("shortcutOf", () => {
  it("reads the table's keys off a keyboard event", () => {
    expect(shortcutOf(key("e"))).toEqual({ key: "e" });
    expect(shortcutOf(key("S", { shiftKey: true }))).toEqual({
      key: "s",
      shift: true,
    });
    expect(shortcutOf(key("ArrowDown", { altKey: true }))).toEqual({
      alt: true,
      key: "ArrowDown",
    });
    expect(shortcutOf(key("\\"))).toEqual({ key: "\\" });
    expect(shortcutOf(key(",", { ctrlKey: true, metaKey: false }))).toEqual({
      key: ",",
    });
  });

  it("answers null without a modifier and for a bare modifier", () => {
    expect(shortcutOf(key("e", { metaKey: false }))).toBeNull();
    expect(shortcutOf(key("Meta"))).toBeNull();
  });

  it("finds the command that owns the key", () => {
    const rows = [
      command("export", "Export", { shortcut: SHORTCUTS.export }),
      command("snapshot", "Snapshot", { shortcut: SHORTCUTS.snapshot }),
    ];

    expect(findByShortcut(rows, { key: "s", shift: true })?.id).toBe(
      "snapshot"
    );
    expect(findByShortcut(rows, { key: "s" })).toBeNull();
  });
});

describe("formatting", () => {
  it("writes macOS glyphs and the menu's accelerator form", () => {
    expect(formatShortcut(SHORTCUTS.snapshot, "mac")).toBe("⇧⌘S");
    expect(formatShortcut(SHORTCUTS["next-video"], "mac")).toBe("⌥⌘↓");
    expect(formatShortcut(SHORTCUTS.preview, "mac")).toBe("⌘\\");
    expect(formatShortcut(SHORTCUTS.snapshot, "linux")).toBe("Ctrl+Shift+S");

    expect(shortcutKeys(SHORTCUTS["next-video"], "mac")).toEqual([
      "⌥",
      "⌘",
      "↓",
    ]);
    expect(shortcutKeys(SHORTCUTS.snapshot, "windows")).toEqual([
      "Ctrl",
      "Shift",
      "S",
    ]);

    expect(acceleratorOf(SHORTCUTS.snapshot)).toBe("CmdOrCtrl+Shift+S");
    expect(acceleratorOf(SHORTCUTS["next-video"])).toBe("Alt+CmdOrCtrl+Down");
    expect(acceleratorOf(SHORTCUTS.settings)).toBe("CmdOrCtrl+,");
  });
});
