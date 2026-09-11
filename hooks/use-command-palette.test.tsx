import { describe, expect, it, type Mock, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useCommandPalette } from "@/hooks/use-command-palette";
import { type Command, SHORTCUTS } from "@/lib/studio/command-registry";

function command(
  id: string,
  title: string,
  extra: Partial<Omit<Command, "run">> = {}
): Command & { run: Mock<() => void> } {
  const run = mock(() => undefined);
  return {
    enabled: true,
    group: "actions",
    id,
    run,
    title,
    ...extra,
  };
}

function registry() {
  const EXPORT = command("export", "Export…", { shortcut: SHORTCUTS.export });
  const SNAPSHOT = command("snapshot", "Snapshot", {
    enabled: { reason: "The preview is not running yet." },
  });
  const INTRO = command("video:v1", "Intro", { group: "videos" });
  const CHAT = command("chat:s1", "First cut", {
    detail: "Intro",
    group: "videos",
  });
  const LAUNCH = command("project:p1", "Launch", { group: "projects" });
  return {
    base: [EXPORT, SNAPSHOT, INTRO, CHAT, LAUNCH],
    CHAT,
    EXPORT,
    SNAPSHOT,
  };
}

function palette(openedSessionId: string | null = null) {
  const rows = registry();
  return {
    ...rows,
    ...renderHook(
      ({ opened }: { opened: string | null }) =>
        useCommandPalette(rows.base, opened),
      { initialProps: { opened: openedSessionId } }
    ),
  };
}

describe("useCommandPalette", () => {
  it("adds the palette's own command to the registry with ⌘K", () => {
    const { result } = palette();
    const own = result.current.commands.find((row) => row.id === "palette");

    expect(own?.shortcut).toEqual(SHORTCUTS.palette);
    expect(result.current.groups.flatMap((group) => group.items)).not.toContain(
      own
    );
  });

  it("toggles on its command and clears the query when it opens", () => {
    const { result } = palette();

    act(() => result.current.onQueryChange("stale"));
    act(() => result.current.run("palette"));
    expect(result.current.isOpen).toBe(true);
    expect(result.current.query).toBe("");

    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(false);
  });

  it("shows every group in order on empty input, Recent first once something was reached", () => {
    const { result } = palette();

    expect(result.current.groups.map((group) => group.id)).toEqual([
      "actions",
      "videos",
      "projects",
    ]);

    act(() => result.current.run("export"));

    expect(result.current.groups.map((group) => group.id)).toEqual([
      "recent",
      "actions",
      "videos",
      "projects",
    ]);
    expect(result.current.groups[0]?.items.map((row) => row.id)).toEqual([
      "export",
    ]);
  });

  it("counts the chat the sidebar opened as reached", () => {
    const view = palette("s1");

    expect(view.result.current.groups[0]?.id).toBe("recent");
    expect(view.result.current.groups[0]?.items).toEqual([view.CHAT]);
  });

  it("narrows every group by the query and drops the empty ones", () => {
    const { result } = palette();

    act(() => result.current.onQueryChange("in"));

    expect(
      result.current.groups.map((group) => [
        group.id,
        group.items.map((row) => row.id),
      ])
    ).toEqual([["videos", ["video:v1", "chat:s1"]]]);
  });

  it("runs an enabled entry and closes, leaves a disabled one open", () => {
    const { EXPORT, SNAPSHOT, result } = palette();

    act(() => result.current.setOpen(true));
    let ran = false;
    act(() => {
      ran = result.current.run("snapshot");
    });
    expect(ran).toBe(false);
    expect(result.current.isOpen).toBe(true);
    expect(SNAPSHOT.run).not.toHaveBeenCalled();

    act(() => {
      ran = result.current.run("export");
    });
    expect(ran).toBe(true);
    expect(result.current.isOpen).toBe(false);
    expect(EXPORT.run).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape from the input and claims the key", () => {
    const { result } = palette();
    act(() => result.current.setOpen(true));

    const preventDefault = mock();
    act(() =>
      result.current.onInputKeyDown({
        key: "Escape",
        preventDefault,
      } as unknown as React.KeyboardEvent<HTMLInputElement>)
    );

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(result.current.isOpen).toBe(false);
  });
});
