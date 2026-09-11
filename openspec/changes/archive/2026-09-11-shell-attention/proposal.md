## Why

The studio already knows the four moments it needs a person back: a turn ended, the agent is waiting on a permission card, an export finished or failed, the sidecar gave up restarting. Each has a place in the window, and the window is where the person is not — a turn takes minutes, a render takes longer, and the studio is one of several apps on the screen. The in-app mark for a turn that ended elsewhere exists (`history/chat-pane`, *A turn that ends elsewhere marks its row*) and is a 6 px dot nobody has noticed in use. Post-launch, the first thing people will do is start a turn and switch to something else; v2 opens with making the studio call them back.

## What Changes

- **One attention chain, three volumes.** An event that needs a person is shown in its own pane; if its chat is not on screen it marks the chat's row; if the window is not focused it also posts a macOS notification. The chain is the same for every event; only the wording differs.
- **System notifications** for: a turn that ended, a permission card (or source question) waiting, an export that finished or failed, a sidecar that stayed down after its retries. Posted only while the window is not focused. Clicking one brings the window forward and opens the chat the event belongs to.
- **Consent is a section of its own.** Settings › Notifications holds a master switch, off by default, a *Grant permission* button whenever macOS has not allowed the studio to notify (it asks macOS, or opens the studio's row in System Settings once macOS has refused), and one switch per event so a person can keep the card and drop the export, or the other way round.
- **A Dock badge** counts the permission cards and source questions waiting across every video, regardless of focus, and clears as they are answered.
- **Dock progress** for a running export: one bar from the start of the render to the finished file, indeterminate while the composition is measured and while audio and video are combined, briefly in error when the render fails.
- **The unread mark becomes visible.** The row's dot grows into a mark that reads as *news* at a glance and carries the same weight in the collapsed rollup.

## Non-goals

- No in-app notification centre or history of past notices — the chat pane and the sidebar are that.
- No sound. macOS plays the notification sound the person configured; the studio adds none.
- No menu-bar (tray) item. Dock progress covers the render; a tray with Cancel is a separate change if it is ever wanted.
- No notifications for anything the person can only act on in the window with it focused: tips, updates, trial cards.
- No notification when the turn ended in the chat on screen — the pane shows it, and the person is there.
- Multiple windows stay out of scope; every decision here assumes one window.

## Capabilities

### New Capabilities

- `shell/attention`: how the studio calls a person back — the attention chain, the notification events and their wording, focus as the gate, the click that opens the chat, the Dock badge, and the failure direction when macOS refuses.

### Modified Capabilities

- `shell/settings-page`: the rail gains Notifications, and a new requirement describes the section — master switch, permission button, a switch per event.
- `export/mp4-export`: *The run says which stage it is in and how far it has come* gains the Dock progress bar and its mapping of stages.
- `history/chat-pane`: *A turn that ends elsewhere marks its row* is reworded so the mark is a visible mark, not a dot that reads as decoration, and so the mark is the first link of the attention chain.

## Impact

- **Shared contract**: none. Every event already reaches the webview as a frame (`agent.prompt` stream, `ExportEvent`, sidecar status). No protocol bump.
- **Sidecar**: none.
- **Rust core**: `tauri-plugin-notification` added with its capability; `core:window:allow-set-progress-bar` and `core:window:allow-set-badge-count` permissions. Whether a click on a macOS notification reaches the webview is verified as the first task; see design.md.
- **Webview**: a new `hooks/use-attention.ts` fed by the turn state, the export state and the sidecar status; `lib/studio/attention.ts` (pure: which events, which words, when to post) and `lib/studio/notifications.ts` (the Effect wrapper over the plugin); `notifications` and four `notify*` keys in `settings.json`; the unread mark in `session-item.tsx` and the rollup in `video-group.tsx`; a Notifications section in the Settings page.
- **Dependencies**: `@tauri-apps/plugin-notification` (webview) and `tauri-plugin-notification` (core). Both are MIT, both first-party Tauri.
- Linear: to be filed under the v2 milestone; no ticket yet.
