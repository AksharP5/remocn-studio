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
import { fileManagerName } from "@/lib/studio/platform";

export class MenuError extends Data.TaggedError("MenuError")<{
  message: string;
}> {}

export interface MenuProject {
  readonly id: string;
  readonly isActive: boolean;
  readonly isMissing: boolean;
  readonly name: string;
}

export interface AppMenuModel {
  readonly canCreateVideo: boolean;
  readonly onLocateProject: () => void;
  readonly onNewProject: () => void;
  readonly onNewVideo: () => void;
  readonly onOpenFolder: () => void;
  readonly onRemoveProject: () => void;
  readonly onRenameProject: () => void;
  readonly onRevealProject: () => void;
  readonly onSelectProject: (projectId: string) => void;
  readonly open: MenuProject | null;
  readonly projects: readonly MenuProject[];
}

const fail = (cause: unknown) =>
  new MenuError({ message: errorMessage(cause) });

// Replacing the app menu wholesale is the only way to own the File submenu, so
// every standard submenu is rebuilt here too — dropping Edit would silently
// take Cmd+C/V away from the webview, and dropping Quit would take Cmd+Q.
export function installAppMenu(
  model: AppMenuModel,
  isCurrent: () => boolean
): Effect.Effect<void, MenuError> {
  return Effect.tryPromise({
    catch: fail,
    try: () => install(model, isCurrent),
  });
}

async function install(
  model: AppMenuModel,
  isCurrent: () => boolean
): Promise<void> {
  const menu = await Menu.new({
    items: await Promise.all([
      applicationMenu(),
      fileMenu(model),
      projectMenu(model),
      editMenu(),
      viewMenu(),
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

function predefined(item: PredefinedMenuItemOptions["item"]) {
  return PredefinedMenuItem.new({ item });
}

// macOS titles this submenu with the app's own name; the text is only what
// other platforms would show.
function applicationMenu() {
  return submenuOf("Remocn Studio", [
    predefined({ About: null }),
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

function fileMenu(model: AppMenuModel) {
  const projectRows =
    model.projects.length === 0
      ? []
      : [
          predefined("Separator"),
          ...model.projects.map((project) =>
            CheckMenuItem.new({
              action: () => model.onSelectProject(project.id),
              checked: project.isActive,
              text: project.name,
            })
          ),
        ];

  return submenuOf("File", [
    MenuItem.new({
      accelerator: "CmdOrCtrl+N",
      action: model.onNewVideo,
      enabled: model.canCreateVideo,
      text: "New Video…",
    }),
    MenuItem.new({
      accelerator: "CmdOrCtrl+Shift+N",
      action: model.onNewProject,
      text: "New Project…",
    }),
    MenuItem.new({
      accelerator: "CmdOrCtrl+O",
      action: model.onOpenFolder,
      text: "Open Folder…",
    }),
    ...projectRows,
    predefined("Separator"),
    predefined("CloseWindow"),
  ]);
}

// The row is disabled rather than dropped when it does not apply, so the menu
// keeps one shape and nothing appears to come and go between projects.
function projectMenu(model: AppMenuModel) {
  const { open } = model;

  return submenuOf("Project", [
    MenuItem.new({
      action: model.onRenameProject,
      enabled: open !== null,
      text: "Rename…",
    }),
    MenuItem.new({
      action: model.onLocateProject,
      enabled: open !== null,
      text: open?.isMissing ? "Locate…" : "Move…",
    }),
    MenuItem.new({
      action: model.onRevealProject,
      enabled: open !== null && !open.isMissing,
      text: `Reveal in ${fileManagerName()}`,
    }),
    predefined("Separator"),
    MenuItem.new({
      action: model.onRemoveProject,
      enabled: open !== null,
      text: "Remove from Studio…",
    }),
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

function viewMenu() {
  return submenuOf("View", [predefined("Fullscreen")]);
}

function windowMenu() {
  return submenuOf("Window", [
    predefined("Minimize"),
    predefined("Maximize"),
    predefined("Separator"),
    predefined("BringAllToFront"),
  ]);
}

async function submenuOf(
  text: string,
  items: readonly Promise<
    CheckMenuItem | MenuItem | PredefinedMenuItem | Submenu
  >[]
) {
  return Submenu.new({ items: await Promise.all(items), text });
}
