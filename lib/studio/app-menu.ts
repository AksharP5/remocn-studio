import {
  CheckMenuItem,
  Menu,
  MenuItem,
  PredefinedMenuItem,
  type PredefinedMenuItemOptions,
  Submenu,
} from "@tauri-apps/api/menu";
import { Data, Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import {
  acceleratorOf,
  type Command,
  type MenuName,
} from "@/lib/studio/command-registry";

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
  const rowsOf = (name: MenuName) =>
    commands.filter((command) => command.menu === name);

  const menu = await Menu.new({
    items: await Promise.all([
      applicationMenu(rowsOf("app"), run),
      fileMenu(rowsOf("file"), run),
      submenuOf("Project", itemsOf(rowsOf("project"), run)),
      editMenu(),
      submenuOf("View", [
        ...itemsOf(rowsOf("view"), run),
        predefined("Separator"),
        predefined("Fullscreen"),
      ]),
      submenuOf("Video", itemsOf(rowsOf("video"), run)),
      windowMenu(),
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
function applicationMenu(commands: readonly Command[], run: RunCommand) {
  return submenuOf("Remocn Studio", [
    predefined({ About: null }),
    predefined("Separator"),
    ...itemsOf(commands, run),
    predefined("Separator"),
    predefined("Services"),
    predefined("Separator"),
    predefined("Hide"),
    predefined("HideOthers"),
    predefined("ShowAll"),
    predefined("Separator"),
    predefined("Quit"),
  ]);
}

function fileMenu(commands: readonly Command[], run: RunCommand) {
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
    predefined("CloseWindow"),
  ]);
}

function editMenu() {
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

function windowMenu() {
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
