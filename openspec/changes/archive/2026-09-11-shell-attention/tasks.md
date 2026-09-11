## 1. Spike: what a macOS notification click delivers

- [x] 1.1 Add `tauri-plugin-notification` to `src-tauri/Cargo.toml` and `@tauri-apps/plugin-notification` to `package.json`, register the plugin in `src-tauri/src/lib.rs`, add `notification:default` to `src-tauri/capabilities/default.json`; verify `cargo check` and `bun run typecheck` pass
- [x] 1.2 Add `core:window:allow-set-progress-bar` and `core:window:allow-set-badge-count` to the capability, and the `x-apple.systempreferences:` scheme to the opener permission; verify `cargo check` passes and the capability file validates on `bun tauri build --no-bundle`
- [ ] 1.3 (verified in dev only: notifications arrive under Terminal; the bundle's badge-beside-bar and click-brings-window checks are still open) In a bundled build (`bun tauri build --no-sign --bundles app`), post one notification from the devtools console and click it; record in design.md whether a click callback reaches the webview, which of the two accepted outcomes applies, and whether the Dock badge and bar render beside each other

## 2. Pure model

- [x] 2.1 Write `lib/studio/attention.ts`: `AttentionEvent`, `attentionEvents(before, after, context)` over the turn map, the export reading and the sidecar phase, returning events tagged `mark` / `notify` with title and body worded per the spec; verify `lib/studio/attention.test.ts` covers turn ended (open chat / other chat / unfocused), a card appearing once and not on re-render, a source question, export finished and failed, sidecar down, and the switch-off case posting nothing
- [x] 2.2 Write `lib/studio/dock.ts`: `dockProgressOf(exportState)` returning the `ProgressBarState` per the table in design.md, and `badgeCountOf(turns)`; verify `lib/studio/dock.test.ts` covers measuring, rendering at half, encoding continuing the bar, combining, done, cancelled and failed
- [x] 2.3 Write `lib/studio/notifications.ts`: `isGranted`, `requestPermission`, `post` as Effects failing with a `NotificationError` tagged error, and `openNotificationSettings` through the opener; verify `lib/studio/notifications.test.ts` with `mockIPC` covers granted, denied, a rejected post, and the no-transport case

## 3. Settings

- [x] 3.1 Add `notifications: boolean | null` to `lib/studio/settings.ts` with `saveNotifications`; verify `lib/studio/settings.test.ts` decodes a file without the key as `null`
- [x] 3.2 Add `notifyEvents` (`turnEnded`, `waiting`, `export`, `sidecar`, each `boolean | null`) to `lib/studio/settings.ts` with `saveNotifyEvent`, and `notifyEventOf(kind)` plus the per-event gate to `lib/studio/attention.ts`; verify `settings.test.ts` reads a missing event key as `null` and `attention.test.ts` drops an event whose switch is off while keeping the others
- [x] 3.3 Extend `hooks/use-notification-consent.ts`: `permission` read through `readPermission` in `lib/studio/notifications.ts`, `isEnabled` (the master wish), `isOn` (wish and permission), `events` with `setEvent`, `grant` (asks on `default`, opens System Settings on `denied`), `toggle` writing the wish and asking when not granted; verify `hooks/use-notification-consent.test.tsx` covers granted, denied, default, unavailable, grant on each, and an event switch written down
- [x] 3.4 Add a `notifications` section to `use-settings-view.ts` and `components/studio/settings-page.tsx` — master switch, the permission line with *Grant permission*, one switch per event — and take the group out of Behavior; verify `components/studio/settings-page.test.tsx` shows the section from the rail, the master switch on when granted, *Grant permission* with the refused wording when denied, the four event switches, and the unavailable wording without a transport

## 4. Focus and the runner

- [x] 4.1 Extend `watchWindowFocus` in `lib/studio/shell.ts` to report both edges, and add `hooks/use-window-focus.ts` keeping the latest value in a ref; verify `hooks/use-window-focus.test.tsx` with `mockIPC` flips on both events and unlistens on unmount
- [x] 4.2 Write `hooks/use-attention.ts`: runs `attentionEvents` on every change of the turn map, export state and sidecar phase, reads the focus ref and the consent state, posts through `lib/studio/notifications.ts` with failures logged and dropped, and opens the chat on an attributed click through the sidebar's own setter; verify `hooks/use-attention.test.tsx` covers posting only while unfocused and consented, once per event, and never throwing into the caller
- [x] 4.3 Write `hooks/use-dock.ts`: calls `setProgressBar` from `dockProgressOf` on export-state change with the 3 s error hold as a forked `Effect.sleep` interrupted by the next state, and `setBadgeCount` from `badgeCountOf` only when the count changes; verify `hooks/use-dock.test.tsx` with `mockIPC` and fake timers covers the hold, the interrupt, and the clear
- [x] 4.4 Mount `useAttention` and `useDock` in `components/studio/studio-provider.tsx` beside `useAppMenu`; verify `app/page.test.tsx` still passes with the IPC fakes

## 5. The unread mark

- [x] 5.1 Enlarge the unread mark in `components/studio/session-item.tsx` into the leading slot at the weight of the running and waiting marks, keep the title at foreground tone while unread, and give the rollup in `components/studio/video-group.tsx` the same mark with its count; verify `components/studio/session-item.test.tsx` and `video-group.test.tsx` assert the mark, the label *has news*, and the rollup count
- [x] 5.2 Run `bun run fix` then `bun run typecheck` on the touched components; verify no attribute was dropped or duplicated

## 6. Wrap up

- [x] 6.1 `bun run check`, `bun run typecheck`, the touched test files, then `bun run test` once; verify all green
- [x] 6.2 `bun run changeset` for the user-visible work (notifications, Dock progress and badge, the visible unread mark)
- [ ] 6.3 (verified in dev: the switch, a turn ending while another app is in front, the event switches; the bundle checks are still open) Ask the user to verify in a bundled build: turn the switch on and see the macOS prompt, start a turn and switch apps until it ends, answer a card and watch the badge clear, export and watch the Dock bar, click a notification and confirm the outcome recorded in 1.3
