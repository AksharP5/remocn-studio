## Context

See proposal.md — Why. What shapes the approach:

- The application menu is installed from the webview: `lib/studio/app-menu.ts` builds File / Project / Edit / View / Window through `@tauri-apps/api/menu` from an `AppMenuModel` of callbacks, and `hooks/use-app-menu.ts` reinstalls it whenever the model changes, swallowing the failure when there is no core. Three accelerators exist there (⌘N, ⇧⌘N, ⌘O).
- Four key handlers live in hooks: ⌘, in `use-settings-view`, Escape in `use-tools` (disarms Inspect/Snapshot unless `defaultPrevented`), Enter and Escape in `use-composer`. Each is a `window`/element `keydown` listener.
- `components/ui/command.tsx` already exists: a Base UI `Dialog` around the Base UI `Autocomplete` (input, list, groups, empty state). It has never been mounted.
- Every action a command will run already has a hook that owns it and words its failures: `useTools` (Inspect, Snapshot, with `unavailable` reasons), `useExport` (`open`, `unavailable`), `useSettingsView`, `useVideos`, the pane toggles, `useSidecar.restart`, `useTurns.stop`. The registry adds no behaviour; it names what exists.
- The studio-provider is where all of these hooks already meet, which is where the registry can be assembled from explicit inputs.

## Goals / Non-Goals

**Goals:**

- The registry is pure data with pure helpers; the three readers contain no decisions.
- No command carries logic of its own; `run` calls a hook that already exists.
- A shortcut has exactly one owner that fires it, and a test proves the table has no duplicates.

**Non-Goals:**

- Ranking, fuzzy scoring, or search over anything but titles.
- Persisting recent entries.
- Global (system-wide) shortcuts; every key here is the window's.

## Decisions

### The registry is assembled from explicit inputs, not registered by each hook

`lib/studio/command-registry.ts` (not `commands.ts`: that module already exists and holds `commandLead`, the display of a Bash prefix) defines `Command` — `{ id, title, group: "actions" | "videos" | "projects", shortcut?: Shortcut, enabled: true | { reason: string }, checked?: boolean, run }` — and `hooks/use-commands.ts` builds the list from the hooks the provider already holds, memoised on their outputs. The alternative, a context where every hook registers its own commands on mount, was rejected: registration order would decide menu order, a hook unmounted in a test would silently drop its commands, and there would be no single place to read the whole list. Assembly in one function makes the registry a value that a test can build from fakes and assert over.

### Matching is word containment over normalised titles

`matchCommands(query, commands)` splits the query on whitespace, normalises both sides (NFD, diacritics stripped, lower-cased) and keeps a command when every word is a substring of its title. Within a group the order is the source's order (the sidebar's for videos and chats, the known-projects order for projects, the table's for actions). Fuzzy scoring was considered and rejected: the lists are tens of entries, and a person who types *int* should see *Intro* and *Interview* in the order the sidebar shows them, not in an order a score invented.

### Recent is an in-memory ring of eight

`use-command-palette.ts` keeps the last eight ids reached through the palette or through the sidebar: the palette pushes what it runs, and an effect on the opened chat's id pushes `chat:<id>` whenever it changes, whichever surface changed it. That is one line instead of threading an `onReached` callback into the sidebar's setter, and it counts a chat opened by a deep link too. It is state of the running app, not a settings key; on relaunch the palette opens on the full list. Writing it down was considered and dropped from this change because it needs a schema for ids that outlive a video's deletion.

### Two key owners, one per shortcut, decided by a spike

macOS delivers a key equivalent to the focused view first and to the menu after, and WKWebView forwards the key to the page before answering. Which reader fires a given shortcut while the composer has focus — the native accelerator, the page's `keydown`, or both — is what the first task measures in a bundled build: press ⌘E with the caret in the composer, log both the menu event and the `keydown`, record what arrived.

The registry carries `owner: "menu" | "page"` per shortcut and the design is the same for both outcomes:

- A `menu`-owned shortcut is bound as the menu row's `accelerator`, and `use-shortcuts` ignores it.
- A `page`-owned shortcut is matched by `use-shortcuts` from `keydown`, which calls `preventDefault` when it handles the key so the native accelerator does not fire a second time; the menu row still shows the shortcut as its `accelerator`, which is display and binding in one.
- ⌘K is `page`-owned in every outcome: it is not a menu row. ⌘, is `page`-owned too, so Settings opens the same way it did before this change.
- When no menu is installed — a browser, happy-dom, a failed install — `use-app-menu` answers `false` and the page dispatcher fires every shortcut, `menu`-owned ones included. That is what keeps the spec's "a reader without a core" scenario true and what lets `settings-page.test.tsx` keep asserting ⌘, against the whole shell.

A test asserts every shortcut in the table has exactly one owner and no two commands share a shortcut. Should the spike show that the page never sees a `keydown` for a menu accelerator and the menu never fires while the webview is focused, the default owner flips to `page` and nothing else in the design moves.

**Outcome (2026-09-11):** verified in the running app with the implementation itself as the instrument, no temporary code. With the default owner `menu`, ⌘E with the caret in the composer opens the Export dialog once, and ⌘K, ⌥⌘↓, ⌘2 with the sidebar hidden, and Escape on the palette with Inspect armed all behaved as specified. The owner table stays as shipped.

### The palette is the existing `command.tsx`, and Escape is handled inside it

`components/studio/command-palette.tsx` mounts `CommandDialog` with the Autocomplete input and grouped list, rendering only what `use-command-palette` returns. Escape is caught on the input's `onKeyDown` with `preventDefault` before closing, so the window listener in `use-tools` sees `defaultPrevented` and leaves Inspect armed — the same rule the comment card and the composer already follow. A disabled entry renders its reason as the item's description and Enter on it is a no-op; the reason string is the one the owning hook exposes (`useTools(...).unavailable`, `useExport(...).unavailable`), so the palette, the menu and the header button word the refusal identically by construction.

### The menu is rebuilt from the registry, and rebuilt only when its shape changes

`app-menu.ts` keeps its install-and-swap structure but takes `readonly Command[]` and builds File, Project, View and Video from the groups, with `enabled`, `checked` and `accelerator` read off each command. `use-app-menu` reinstalls on a change of the menu's *shape* — a string of `id:title:enabled:checked` per row — rather than on any change of the registry object, because `enabled` for Stop the turn flips with every turn and a reinstall swaps the whole `NSMenu`. Measured in `hooks/use-app-menu.test.tsx`: a registry re-created twice with new `run` closures and the same shape installs the menu **once**, and the row's action still reaches the newest closure through the ref; flipping one row's `enabled` installs a second time. So a turn costs at most two installs — Stop the turn going enabled and disabled — not one per stream event.

### Settings sits in the application menu

macOS puts *Settings…* ⌘, under the application's own menu, so the registry carries a fifth menu name, `app`, and the builder places its rows between About and Services. The other four names map to File, Project, View and Video.

### Hotkeys is a view of the table, not a second table

`SHORTCUT_TITLES` and `HOTKEY_GROUPS` sit beside `SHORTCUTS` in the registry, so the Settings section renders from the same constants the dispatcher and the menu read, and a test asserts every `ShortcutId` appears in exactly one group with a title. The titles there are static ("Show or hide the preview") where the menu's are stateful ("Hide the preview"): a reference reads the same whatever is on screen. `shortcutKeys` splits a shortcut into one `<Kbd>` per key; `formatShortcut` is that list joined.

### Scattered handlers move, Escape stays

The ⌘, listener in `use-settings-view` is removed and Settings becomes a registry command. The Escape handlers in `use-tools` and `use-composer` stay: Escape is not a shortcut in the table, it is each surface's own dismissal, and pulling it into a global dispatcher would need the dispatcher to know which surface is on top.

### Failure direction

A `run` that fails does so inside the hook that owns it, which already words the failure where the action lives (an export refusal under the preview, a sidecar restart error on the status card). The palette shows no errors of its own and never blocks on a `run`. A menu install that fails is swallowed as today. A `keydown` for a key the registry does not know is not touched.

## Risks / Trade-offs

- [Native accelerators do not fire while the composer has focus] → the spike decides the owner; the page dispatcher is the fallback and the design does not change.
- [A shortcut double-fires] → one owner per shortcut, `preventDefault` when the page handles, and a test over the table.
- [Menu reinstall on every turn tick] → reinstall on shape change only; counted in the landing task.
- [⌘\ is awkward on non-US layouts] → accepted for v2; the table is the studio's and the palette shows the key.
- [Base UI Autocomplete's own key handling swallows Enter or arrows the palette needs] → the palette is built on the generated primitive; if it fights, the fix is in `command-palette.tsx`, not in the registry.
- [`bun run fix` on the new component] → typecheck after it, per CLAUDE.md.

## Migration Plan

Additive in the webview only. No settings key, no protocol bump, no migration. Rolling back is removing the dispatcher and restoring the three-accelerator menu; nothing on disk changes.
