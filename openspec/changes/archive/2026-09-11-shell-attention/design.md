## Context

See proposal.md — Why. What shapes the approach:

- Every attention event already reaches the webview as a frame it folds today: the turn stream (`hooks/use-turns.ts` settles a turn in `Effect.onExit`, and already computes `away = open.current !== historyId` to set `unread`), `ExportEvent` (`hooks/use-export.ts` holds `percent`, `status`, `result`, `trouble`), and the sidecar status event (`sidecar/supervision`, phase `down`).
- Window focus is already watched: `watchWindowFocus` in `lib/studio/shell.ts` wraps `getCurrentWindow().onFocusChanged` as `Effect.acquireRelease`, though it currently reports only the *gained* edge.
- The unread mark exists end to end — `TurnState.unread`, `lib/studio/groups.ts` rollup, `components/studio/session-item.tsx` (a `size-1.5` dot) and `video-group.tsx` — and has gone unnoticed in use. Nothing new is stored.
- `@tauri-apps/api@2.11.1` carries `setProgressBar` and `setBadgeCount` on `Window`; both are macOS-native (Dock) and need only a capability permission, no plugin. There is no notification plugin in the tree yet.
- The app is one window, `main`; every emit in `src-tauri` targets it.

## Goals / Non-Goals

**Goals:**

- One pure function decides what deserves attention and at what volume; every surface (row mark, notification, badge, Dock bar) reads its result.
- Zero new wire contract: no frame, no protocol bump, no migration.
- Nothing about attention can fail the turn, the export or the sidecar it reports on.

**Non-Goals:**

- Attributing a notification click when the platform cannot: the design has a defined behaviour for both outcomes and does not build a heuristic.
- Sound, tray, notification history, multi-window.

## Decisions

### The webview owns attention, not the core or the sidecar

Only the webview knows which chat is on screen and whether the window is focused, and both are inputs to the chain. The sidecar's unused `SidecarNotification` frame was considered as the transport for "post a notification" and rejected: it would put the focus decision in a process that cannot see focus, and it would make the sidecar say the video's *name*, which lives in the webview's project state. The core could post notifications from Rust with the same blind spot. So: `lib/studio/attention.ts` (pure), `hooks/use-attention.ts` (the runner), and thin Effect wrappers over the platform calls.

### One pure diff decides the events

`lib/studio/attention.ts` exports `attentionEvents(before, after, context)` where `before`/`after` are the turn map plus the export and sidecar readings, and `context` is `{ openHistoryId, isFocused, videoNames }`. It returns a list of `AttentionEvent` — `{ kind: "turn-ended" | "waiting" | "export-finished" | "export-failed" | "sidecar-down", historyId | videoId, title, body }` — each tagged with the surfaces it earns: `mark`, `notify`. The hook subscribes to state changes, runs the diff, and dispatches. Diffing rather than hooking each event site keeps dedup in one place: a permission card posts once when it *appears* (it is in `after.permissions` and not in `before.permissions`), never on re-render, and a turn end posts once because `isRunning` flips once. Tests are table-driven over `(before, after, context)` with no DOM.

Alternative rejected: calling `notify()` inside `use-turns`' `onExit`, `use-export`'s reducer and the sidecar status handler. Three call sites, three places to get the focus gate wrong, and the export hook has no access to the turn map for the "is the chat open" question.

### Focus is a ref, read at dispatch time

`watchWindowFocus` gains the lost edge (it already receives `payload: boolean` and drops `false`). `useWindowFocus` keeps the latest value in a ref that `use-attention` reads when the diff runs, the way `useTurns` reads the plan tier at dispatch. A focus *transition* is not itself an event: coming back to the window clears nothing (the unread mark clears on opening the chat, per spec) and the badge is focus-independent.

`document.hasFocus()` was considered and not taken: it is a poll, not an event, so it would have to be read on a timer or on every state change, and `watchWindowFocus` already exists as a scoped subscription. Not measured; if the window event proves late on macOS, that is the place to measure.

### Notifications go through `tauri-plugin-notification`, and the click is a spike with two accepted outcomes

The plugin is first-party, and its JS API (`isPermissionGranted`, `requestPermission`, `sendNotification`) matches the consent requirement one-to-one. `lib/studio/notifications.ts` wraps the three in `Effect.tryPromise` with a `NotificationError` tagged error; `post` is run through `Effect.ignoreLogged`-style handling so a rejected post logs and returns.

What the plugin does on a macOS **click** is not documented as reliable: its desktop backend goes through `notify-rust`, and on macOS the delivered-notification delegate belongs to the process that posts, which for an unbundled debug binary is not the app. The first task is therefore a spike in a **bundled** build (`bun tauri build --no-sign --bundles app`): post a notification, click it, and record whether `onAction`/a click callback reaches the webview.

- If it does: the payload carries `historyId` (or `videoId` for an export), and `use-attention` opens that chat through the same setter the sidebar row uses.
- If it does not: the click brings the window forward (macOS does this on its own for a running app) and the studio changes nothing. The row mark is the way in. This is the behaviour the spec names; it needs no code beyond not guessing.

**What the plugin's source settles before the spike (2026-09-11):** on desktop `@tauri-apps/plugin-notification` does not talk to the core for a post at all. `sendNotification` is `new window.Notification(title, options)`, `requestPermission` is `window.Notification.requestPermission()`, and `isPermissionGranted` reads `window.Notification.permission` and asks the core only while it is still `default`. `window.Notification` is the shim the Rust plugin injects into the webview, and that shim carries no click callback; `onAction` is the mobile listener. So the click cannot be attributed on macOS through this plugin: the second outcome is the one that applies, `use-attention` only posts, and the bundled-build check is left with the visual questions — the prompt, the badge beside the bar, the window coming forward on a click.

Verified in the running app (2026-09-11): in `bun tauri dev` nothing arrived until Terminal was allowed under System Settings › Notifications, because the plugin signs a development post with `com.apple.Terminal` (`tauri::is_dev()` in its `desktop.rs`); with Terminal allowed, the turn-ended notification arrived with the video's name. A bundled build signs with the app's own identifier and needs its own row there.

Two consequences for the code: the webview fakes in tests stand in `window.Notification`, not the IPC, and a page without the shim (a browser, happy-dom) reads as *unavailable* from a `TypeError` in the wrapper rather than from a refused invoke.

Alternative rejected: "on activation within N seconds of a post, open the most recent unread chat". A Dock click, a ⌘-Tab, or a click on the window itself would all trigger it and jump the person to a chat they did not ask for. The spec forbids guessing.

Alternative deferred: posting from Rust through `UNUserNotificationCenter` with the app as delegate, which would make the click reliable. It needs a bundle identifier at runtime (no `bun tauri dev`), a signed build to test, and an objc2 dependency. If the spike says the plugin cannot deliver the click, this is the follow-up change, not a fallback inside this one.

### Consent is a section: one master key, one key per event, and permission as a separate reading

`settings.json` gains `notifications: boolean | null` (null = never asked = off) and `notifyTurnEnded`, `notifyWaiting`, `notifyExport`, `notifySidecar` (null = on), all read through `useHydratedSettings` like `assetOffers`. The master switch is the person's wish; whether macOS allows it is a separate reading, `permission`, taken from the shim's `Notification.permission` (`granted` / `denied` / `default`) and from `isPermissionGranted` while it is still `default`. A notification posts only when the wish, the permission and the event's own switch all agree — `isOn` is the first two, the event switch is checked in the pure diff so a table test covers it.

Turning the master switch on writes `true` at once and then asks macOS if it has not yet granted; a person's wish is not thrown away because the OS said no, it is shown beside a *Grant permission* button. That button is one gesture with two meanings decided by the reading: `default` asks (the system prompt), `denied` opens `x-apple.systempreferences:com.apple.Notifications-Settings.extension` through the opener plugin (the scheme is added to the opener capability), because macOS never prompts twice. If opening the URL fails, the words already say where to go — the button's failure is a notice under the row, not a dialog.

The section was first a group under Behavior with one switch; it became a section when the per-event switches and the permission button made it three groups, which is a section's shape in this page.

In a browser or under happy-dom the plugin's `invoke` throws; `isPermissionGranted` failing makes the switch `disabled` with *Needs the desktop app* on its tooltip, mirroring how the app menu install is swallowed.

### The Dock bar is one run, and error is a timed state

`hooks/use-dock-progress.ts` maps the export state to `setProgressBar`:

```
phase                       status         progress
measuring (no total yet)    Indeterminate  -
rendering / encoding        Normal         (rendered + encoded) / (2 * total)
combining                   Indeterminate  -
done / cancelled / idle     None           -
failed                      Error, then None after 3 s
```

Rendered and encoded share one bar so it never falls back to zero when encoding starts its own count. The API's `Indeterminate` is documented as *treated as Normal on macOS*, so the measuring stage is painted as a Normal bar at 0 and the combining stage as a Normal bar held at 100 — an honest empty and an honest full instead of a state the platform would silently rewrite. The 3 s error hold is an `Effect.sleep` forked from the hook and interrupted when the state moves on; a `setTimeout` would need its own cleanup bookkeeping and cannot be interrupted by the next state as structurally. Every `setProgressBar` call is `Effect.ignore`d after logging: a Dock that cannot be painted is not an export problem.

### The badge is a count, written on change

`useDockBadge(turns)` derives `sum(permissions.length + sources.length)` from the turn map and calls `setBadgeCount(n)` or `setBadgeCount()` to clear, only when the number changes. No consent: the badge is drawn by the app on its own icon.

### The unread mark is enlarged, not redesigned

`session-item.tsx` keeps the same `unread` boolean. The dot becomes an 8 px filled circle in `sidebar-primary` placed in the row's leading slot (where the running spinner and the waiting question mark already sit, so it is the same slot at the same weight), and the title of an unread row keeps `text-sidebar-foreground` instead of the muted quiet-row tone. The rollup shows the same circle with the count, in the shape the *waiting* rollup already uses. No new state, no new store field.

## Risks / Trade-offs

- [The plugin does not show notifications from an unbundled debug binary] → the spike runs in a bundled build; the hook's tests are pure over the diff and the Settings row is tested with a fake transport, so the running-app check is one manual pass on a bundle.
- [The click never reaches the webview on macOS] → accepted outcome, specified: the window comes forward and the row mark is the way in. A Rust-side delegate is a named follow-up, not a hidden dependency.
- [A refusal in System Settings after the switch was on] → `isPermissionGranted` is re-read on window focus (via `use-recheck-on-focus`, which exists for the provider probe) so the row flips to the refused wording without a relaunch; posts while refused are dropped by the plugin and logged by us.
- [The Dock bar and a Dock badge share the icon] → macOS draws both; verified visually in the spike.
- [Two exports cannot run, but two turns can end at once] → each posts its own notification; macOS groups them under the app. No coalescing in v1 of this.
- [`bun run fix` on `session-item.tsx`] → typecheck after it, per CLAUDE.md.

## Migration Plan

Additive: a new settings key defaulting to off, two capability permissions, one plugin. No protocol bump, no history migration. Rolling back is removing the hook and the plugin; a `notifications` key left in `settings.json` is ignored by the previous build's decoder.
