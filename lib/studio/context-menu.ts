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

const EDITABLE =
  'input, textarea, [contenteditable=""], [contenteditable="true"]';

const SELECTABLE = "[data-selectable]";

function selectsIn(region: Element, selection: Selection | null): boolean {
  if (
    selection === null ||
    selection.isCollapsed ||
    selection.toString().trim().length === 0
  ) {
    return false;
  }
  const { anchorNode, focusNode } = selection;
  return (
    (anchorNode !== null && region.contains(anchorNode)) ||
    (focusNode !== null && region.contains(focusNode))
  );
}

export function keepsNativeMenu(
  target: EventTarget | null,
  selection: Selection | null = document.getSelection()
): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  if (target.closest(EDITABLE) !== null) {
    return true;
  }
  const region = target.closest(SELECTABLE);
  return region !== null && selectsIn(region, selection);
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
