## 1. Spike: who fires a shortcut while the composer has focus

- [x] 1.1 In a bundled build (`bun tauri build --no-sign --bundles app`), add a temporary menu row with accelerator ⌘E and a temporary `keydown` log, press ⌘E with the caret in the composer and with focus on the preview, and record in design.md which reader fired, whether both did, and whether `preventDefault` on the page suppresses the menu; set the default `owner` in the table accordingly and remove the temporary code

## 2. Pure model

- [x] 2.1 Write `lib/studio/command-registry.ts`: the `Command` and `Shortcut` types, `SHORTCUTS` (the table with its owner per entry), `matchCommands(query, commands)`, `shortcutOf(event)` (maps a `KeyboardEvent` to a `Shortcut` or null), `formatShortcut(shortcut)` (⌘ glyphs) and `acceleratorOf(shortcut)` (the menu's `CmdOrCtrl+…` form); verify `lib/studio/command-registry.test.ts` covers word containment with accents and case, group order preserved, the table having no duplicate shortcut and exactly one owner each, and `shortcutOf` on ⌘E, ⇧⌘S, ⌥⌘↓, ⌘\ and a plain letter
- [x] 2.2 Write `lib/studio/recent.ts`: `pushRecent(ring, id)` keeping eight, most recent first, no duplicates; verify `lib/studio/recent.test.ts` covers overflow and re-reach moving an entry to the front

## 3. Assembly

- [x] 3.1 Write `hooks/use-commands.ts` taking the outputs of `useTools`, `useExport`, `useSettingsView`, `useVideos`, the pane toggles, `useSidecar`, `useTurns` and the projects list, and returning `readonly Command[]` with `enabled` reasons taken from each hook's own `unavailable`; verify `hooks/use-commands.test.tsx` builds the list from fakes and asserts Export's reason equals the export hook's, Videos and Projects follow the sidebar's order, and the open chat is `checked`
- [x] 3.2 Write `hooks/use-shortcuts.ts`: one `window` `keydown` listener that maps the event through `shortcutOf`, runs the `page`-owned command when it is enabled, and calls `preventDefault` only when it handled the key; verify `hooks/use-shortcuts.test.tsx` covers a handled key, an unknown key left alone, a disabled command left alone, and a `menu`-owned shortcut ignored
- [x] 3.3 Remove the ⌘, listener from `hooks/use-settings-view.ts` and make Settings a registry command; verify `hooks/use-settings-view.test.tsx` no longer asserts the key and `use-shortcuts.test.tsx` opens Settings on ⌘,

## 4. The palette

- [x] 4.1 Write `hooks/use-command-palette.ts`: open/close state toggled by the ⌘K command and by `close`, the query, the recent ring fed by `onReached` from the palette and the sidebar's open-chat setter, the grouped and matched entries, `run(id)` closing on success and leaving a disabled entry open; verify `hooks/use-command-palette.test.tsx` covers empty input showing Recent first, a query narrowing every group, Enter on a disabled entry, and ⌘K toggling
- [x] 4.2 Write `components/studio/command-palette.tsx` on `components/ui/command.tsx`, rendering groups, the shortcut glyphs beside each title, the reason on a disabled entry, the *open* mark, and the empty state in words; Escape is caught on the input with `preventDefault` before closing; verify `components/studio/command-palette.test.tsx` renders the groups and asserts Escape leaves an armed Inspect armed through `use-tools`
- [x] 4.4 Add `SHORTCUT_TITLES`, `HOTKEY_GROUPS` and `shortcutKeys` to the registry, a `hotkeys` section to `use-settings-view.ts` and a read-only `HotkeysSection` to `components/studio/settings-page.tsx`; verify `lib/studio/command-registry.test.ts` covers every id in one group and `components/studio/settings-page.test.tsx` shows the list with no controls
- [x] 4.3 Mount the palette and `useShortcuts` in `components/studio/studio-provider.tsx`; verify `app/page.test.tsx` passes and ⌘K opens the palette there

## 5. The menu

- [x] 5.1 Rewrite `lib/studio/app-menu.ts` to build File, Project, View and Video from `readonly Command[]` with `enabled`, `checked` and `accelerator` read off each command, keeping Edit and Window; verify `lib/studio/app-menu.test.ts` with `mockIPC` asserts each menu's rows, the disabled-not-dropped rule, and the checked sidebar view
- [x] 5.2 Change `hooks/use-app-menu.ts` to reinstall on a change of the menu's shape string only, and count installs across one simulated turn; verify `hooks/use-app-menu.test.tsx` asserts one install for a registry whose `run` closures change but whose shape does not, and record the count in design.md

## 6. Wrap up

- [x] 6.1 Run `bun run fix` then `bun run typecheck`; verify no attribute was dropped or duplicated in `command-palette.tsx`
- [x] 6.2 `bun run check`, `bun run typecheck`, the touched test files, then `bun run test` once; verify all green
- [x] 6.3 `bun run changeset` for the palette, the two menus and the shortcut table
- [x] 6.4 Ask the user to verify in the running app: ⌘K from the composer, ⌘E with the caret in the composer, ⌥⌘↓ while typing keeps the draft, ⌘2 with the sidebar hidden, Escape on the palette with Inspect armed, and the View and Video menus with their shortcuts
