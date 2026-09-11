## Why

The studio has three keyboard shortcuts in its menu and four more scattered through hooks, no way to discover any of them, and no way to reach a video or a chat without the mouse. Every action that exists today is defined where it is rendered — the app menu in `lib/studio/app-menu.ts`, Inspect and Snapshot in `use-tools`, Settings in `use-settings-view` — so a palette added the same way would be a fourth copy of the same list. Post-launch, the people who use the studio daily will live in it with a keyboard; v2 gives them one place to ask for anything and one list that the menu, the palette and the shortcuts all read.

## What Changes

- **A command registry.** One list of everything the studio can be asked to do: title, group, whether it applies right now and why not, and an optional shortcut. The application menu, the palette and the keyboard shortcuts are three readers of that list and cannot disagree.
- **A command palette on ⌘K.** One mixed list with groups — Recent, Actions, Videos, Projects — searched by title. Empty input shows what was reached recently. A command that does not apply is shown disabled with its reason, the way Inspect and Snapshot already word theirs on their tooltips.
- **A Hotkeys section in Settings.** The whole shortcut table, read-only, grouped by what it touches, drawn from the same registry the palette and the menus read.
- **A View menu and a Video menu.** View gains the sidebar, the preview, the three sidebar views and Preview/Docs; a new Video menu carries Export, Inspect, Snapshot, Stop the turn and previous/next video. Every entry comes from the registry with its shortcut beside it.
- **Shortcuts.** ⌘K palette · ⌘E Export · ⌘I Inspect · ⇧⌘S Snapshot · ⌘B sidebar · ⌘\ preview · ⌘1 ⌘2 ⌘3 sidebar views · ⌘D Preview/Docs · ⌥⌘↑ ⌥⌘↓ previous/next video · ⌘. stop the running turn · ⇧⌘R restart the studio's helper. ⌘N, ⇧⌘N, ⌘O and ⌘, stay as they are. Previous/next video takes ⌥⌘ rather than ⌘ alone because ⌘↑ and ⌘↓ move the caret in every macOS text field, and the composer is focused most of the time.

## Non-goals

- No user-defined shortcuts and no shortcut editor; the table is the studio's, and the Hotkeys section only shows it.
- No command-line prefix syntax (`>` for actions, `#` for videos). One list, grouped.
- No search over chat contents, documents or assets; the palette matches titles only.
- No recent list across launches; recent is kept for the running app and needs no settings key.
- No chords and no shortcuts that reach the preview's canvas; the picker keeps its own keys.

## Capabilities

### New Capabilities

- `shell/command-palette`: the registry as an observable contract (one title, one availability, one shortcut per command, and the surfaces agreeing), the palette's behaviour, and the shortcut table with which owner fires each one.

### Modified Capabilities

- `shell/layout-and-panes`: *The app menu carries the studio's own File and Project menus* grows into the registry-driven menu with the View items and the Video menu, and the rule that every entry shows its shortcut.
- `shell/settings-page`: the rail gains Hotkeys, and a new requirement describes the read-only list.

## Impact

- **Shared contract**: none. Every command runs something the webview already does.
- **Sidecar**: none.
- **Rust core**: none. The menu is installed from the webview through `@tauri-apps/api/menu` as today; a spike verifies whether native accelerators fire while the composer has focus, and the design names the fallback.
- **Webview**: `lib/studio/command-registry.ts` (the registry as pure data and a pure matcher), `hooks/use-commands.ts` (assembles the registry from the hooks that own each action), `hooks/use-command-palette.ts`, `hooks/use-shortcuts.ts` (the keydown dispatcher), `components/studio/command-palette.tsx` on the existing `components/ui/command.tsx`, and `lib/studio/app-menu.ts` rewritten to read the registry. `use-tools` and `use-settings-view` lose their own key handlers to the dispatcher.
- Linear: to be filed under the v2 milestone; no ticket yet.
