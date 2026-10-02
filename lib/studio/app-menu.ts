import { invoke } from "@tauri-apps/api/core";
import {
  CheckMenuItem,
  Menu,
  MenuItem,
  PredefinedMenuItem,
  type PredefinedMenuItemOptions,
  Submenu,
} from "@tauri-apps/api/menu";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Data, Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import {
  acceleratorOf,
  type Command,
  type MenuName,
} from "@/lib/studio/command-registry";
import { currentPlatform, type Platform } from "@/lib/studio/platform";

export class MenuError extends Data.TaggedError("MenuError")<{
  message: string;
}> {}

export type RunCommand = (id: string) => void;

const fail = (cause: unknown) =>
  new MenuError({ message: errorMessage(cause) });

export function menuShape(commands: readonly Command[]): string {
  return commands
    .filter((command) => command.menu !== undefined)
    .map(
      (command) =>
        `${command.id}|${command.title}|${command.enabled === true ? 1 : 0}|${command.checked === true ? 1 : 0}`
    )
    .join("\n");
}

// Replacing the app menu wholesale is the only way to own the File submenu, so
// every standard submenu is rebuilt here too — dropping Edit would silently
// take Cmd+C/V away from the webview, and dropping Quit would take Cmd+Q.
export function installAppMenu(
  commands: readonly Command[],
  run: RunCommand,
  isCurrent: () => boolean
): Effect.Effect<void, MenuError> {
  return Effect.tryPromise({
    catch: fail,
    try: () => install(commands, run, isCurrent),
  });
}

async function install(
  commands: readonly Command[],
  run: RunCommand,
  isCurrent: () => boolean
): Promise<void> {
  const platform = currentPlatform();
  const rowsOf = (name: MenuName) =>
    commands.filter((command) => command.menu === name);

  const menu = await Menu.new({
    items: await Promise.all([
      applicationMenu(rowsOf("app"), run, platform),
      fileMenu(rowsOf("file"), run, platform),
      submenuOf("Project", itemsOf(rowsOf("project"), run)),
      editMenu(platform),
      submenuOf("View", [
        ...itemsOf(rowsOf("view"), run),
        predefined("Separator"),
        platform === "mac"
          ? predefined("Fullscreen")
          : nativeItem(
              "Toggle Fullscreen",
              async () => {
                const window = getCurrentWindow();
                await window.setFullscreen(!(await window.isFullscreen()));
              },
              "F11"
            ),
      ]),
      submenuOf("Video", itemsOf(rowsOf("video"), run)),
      windowMenu(platform),
    ]),
  });

  if (!isCurrent()) {
    await menu.close();
    return;
  }

  const previous = await menu.setAsAppMenu();
  await previous?.close();
}

type Item = Promise<CheckMenuItem | MenuItem | PredefinedMenuItem | Submenu>;

function predefined(item: PredefinedMenuItemOptions["item"]) {
  return PredefinedMenuItem.new({ item });
}

function nativeItem(
  text: string,
  action: () => Promise<void>,
  accelerator?: string
): Item {
  return MenuItem.new({
    action: () => {
      action().catch((cause: unknown) => {
        console.warn(`menu action ${text} failed: ${errorMessage(cause)}`);
      });
    },
    text,
    ...(accelerator === undefined ? {} : { accelerator }),
  });
}

function itemOf(command: Command, run: RunCommand): Item {
  const shared = {
    action: () => run(command.id),
    enabled: command.enabled === true,
    text: command.title,
    ...(command.shortcut === undefined
      ? {}
      : { accelerator: acceleratorOf(command.shortcut) }),
  };
  return command.checked === undefined
    ? MenuItem.new(shared)
    : CheckMenuItem.new({ ...shared, checked: command.checked });
}

function itemsOf(commands: readonly Command[], run: RunCommand): Item[] {
  return commands.flatMap((command) =>
    command.separatorBefore === true
      ? [predefined("Separator"), itemOf(command, run)]
      : [itemOf(command, run)]
  );
}

// macOS titles this submenu with the app's own name; the text is only what
// other platforms would show.
function applicationMenu(
  commands: readonly Command[],
  run: RunCommand,
  platform: Platform
) {
  return submenuOf("Remocn Studio", [
    predefined({ About: null }),
    predefined("Separator"),
    ...itemsOf(commands, run),
    predefined("Separator"),
    ...(platform === "mac"
      ? [
          predefined("Services"),
          predefined("Separator"),
          predefined("Hide"),
          predefined("HideOthers"),
          predefined("ShowAll"),
          predefined("Separator"),
          predefined("Quit"),
        ]
      : [nativeItem("Quit", () => getCurrentWindow().close(), "CmdOrCtrl+Q")]),
  ]);
}

function fileMenu(
  commands: readonly Command[],
  run: RunCommand,
  platform: Platform
) {
  const actions = commands.filter((command) => command.group !== "projects");
  const projects = commands.filter((command) => command.group === "projects");
  const projectRows =
    projects.length === 0
      ? []
      : [predefined("Separator"), ...itemsOf(projects, run)];

  return submenuOf("File", [
    ...itemsOf(actions, run),
    ...projectRows,
    predefined("Separator"),
    platform === "linux"
      ? nativeItem("Close Window", () => getCurrentWindow().close(), "Ctrl+W")
      : predefined("CloseWindow"),
  ]);
}

function editMenu(platform: Platform) {
  if (platform === "linux") {
    const edit = (command: string, accelerator: string) =>
      nativeItem(
        command === "SelectAll" ? "Select All" : command,
        () => invoke<void>("edit_webview", { command }),
        accelerator
      );

    return submenuOf("Edit", [
      edit("Undo", "Ctrl+Z"),
      edit("Redo", "Ctrl+Shift+Z"),
      predefined("Separator"),
      edit("Cut", "Ctrl+X"),
      edit("Copy", "Ctrl+C"),
      edit("Paste", "Ctrl+V"),
      edit("SelectAll", "Ctrl+A"),
    ]);
  }

  return submenuOf("Edit", [
    predefined("Undo"),
    predefined("Redo"),
    predefined("Separator"),
    predefined("Cut"),
    predefined("Copy"),
    predefined("Paste"),
    predefined("SelectAll"),
  ]);
}

function windowMenu(platform: Platform) {
  if (platform === "linux") {
    return submenuOf("Window", [
      nativeItem("Minimize", () => getCurrentWindow().minimize()),
      nativeItem("Maximize", () => getCurrentWindow().toggleMaximize()),
    ]);
  }

  return submenuOf("Window", [
    predefined("Minimize"),
    predefined("Maximize"),
    predefined("Separator"),
    predefined("BringAllToFront"),
  ]);
}

async function submenuOf(text: string, items: readonly Item[]) {
  return Submenu.new({ items: await Promise.all(items), text });
}
