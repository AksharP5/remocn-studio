import { Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import { MenuError } from "@/lib/studio/app-menu";

export interface ContextAction {
  readonly enabled?: boolean;
  readonly id: string;
  readonly run: () => void;
  readonly separatorBefore?: boolean;
  readonly text: string;
}

const NATIVE_MENU_TARGETS =
  'input, textarea, [contenteditable=""], [contenteditable="true"], [data-selectable]';

export function keepsNativeMenu(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.closest(NATIVE_MENU_TARGETS) !== null
  );
}

let shown: Menu | null = null;

async function popup(actions: readonly ContextAction[]): Promise<void> {
  const items = await Promise.all(
    actions.flatMap((action) => {
      const item = MenuItem.new({
        action: action.run,
        enabled: action.enabled ?? true,
        id: action.id,
        text: action.text,
      });
      return action.separatorBefore === true
        ? [PredefinedMenuItem.new({ item: "Separator" }), item]
        : [item];
    })
  );
  const menu = await Menu.new({ items });
  const previous = shown;
  shown = menu;
  await previous?.close();
  await menu.popup();
}

export function popupContextMenu(
  actions: readonly ContextAction[]
): Effect.Effect<void, MenuError> {
  return Effect.tryPromise({
    catch: (cause) => new MenuError({ message: errorMessage(cause) }),
    try: () => popup(actions),
  });
}
