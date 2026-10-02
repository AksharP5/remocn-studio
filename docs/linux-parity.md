# Linux parity verification

Target: Omarchy 4, x86_64, Hyprland/Wayland, WebKitGTK 4.1. The port retains the upstream editor and Remotion project format. No HyperFrames integration is included.

| Workflow | Evidence |
| --- | --- |
| Editor, preview controls, properties, geometry, text, easing, undo | Existing editor tests retained; native selection, text editing, undo/redo and playback verified |
| Claude, Codex, Copilot and Grok adapters | Existing provider tests retained; launcher PATH includes mise and local binaries |
| Provider setup | Linux terminal opens without executing the copied command; shell tests verify managed Node PATH and quoting |
| Node.js setup | Official Linux archive, SHA-256 verification, immediate/restart discovery, failed-download preservation and incomplete-install repair tests |
| Integration credentials | Real encrypted Secret Service write/read round trip passed |
| Native menus | Linux actions use WebKit editing commands and supported window APIs; native contract tests passed |
| Attention | Linux title count/progress and notification action tests passed; no Unity Dock dependency |
| Crash privacy | XDG consent path and Linux home-path scrubbing tests passed; reports remain opt-in |
| Rendering | Real DOM/SVG/text and moving WebGL2 frames passed |
| Export formats | Real MP4/H.264, WebM/VP9, GIF and MOV/ProRes passed, including audio preservation, computed metadata, odd sizes and 720p scaling |
| Packaging and updates | Signed 1.0.0 → 1.0.1 in-app update passed; installed file matched release SHA-256, app restarted and project remained intact |

## Native app checks

These checks must be completed against the installed AppImage, outside the source checkout's development runtime:

- [x] Launch from the installed desktop entry and confirm the bundled sidecar becomes ready.
- [x] Open the QA project and play/scrub its native preview, including footage and audio.
- [x] Inspect and edit text/properties, then undo and redo.
- [x] Verify native clipboard actions, file dialogs, project navigation, library and settings.
- [x] Export from the app and inspect the resulting video.
- [x] Verify terminal launching and a clickable system notification.
- [x] Verify a signed in-app update and retained project/history data.

## Recorded results

Verified on the installed 1.0.1 AppImage on October 2, 2026:

- 3,386 frontend/sidecar tests passed, 10 optional tests skipped; 84 native tests passed plus an opt-in real Secret Service round trip.
- The native app created `LinuxParity`, restored its library after restart, played footage/audio, rendered a WebGL2 canvas and detected source/metadata changes.
- A text change persisted to `studio.json`; native Undo restored the original and Redo restored the edit.
- Native MP4 exports had H.264 video and AAC audio at 1920 × 1080, 30 fps. The longer export was 30.059 seconds; decoded frames matched the preview. Separate real render smoke tests passed for MP4, WebM, GIF and ProRes.
- Open in Terminal launched Ghostty without running the copied command; its shell started in the home directory.
- An export notification reached QuickShell while Ghostty was in front. Invoking its actual default action through QuickShell returned focus to Studio. Notification consent was restored to its original off setting after verification.
- The signed updater replaced the installed 1.0.0 AppImage with the released 1.0.1 binary. Its SHA-256 matched the release and the project document checksum stayed unchanged. A fresh desktop-entry launch verified the built-in NVIDIA defaults and bundled helper protocol 38.
- Earlier NVIDIA EGL shutdown crashes were reproduced in the old build. The Mesa EGL launch/quit cycle exited cleanly; no new core dumps appeared during final verification. Custom EGL and WebKit overrides are respected.

Native screenshots and decoded export frames are in the local checkout's ignored `artifacts/linux-qa` directory. The release is [v1.0.1](https://github.com/AksharP5/remocn-studio/releases/tag/v1.0.1).

## Follow-up audit: 1.0.2

Rechecked on October 2, 2026:

- The fork includes upstream `86f64ee6b2e5b9fa69c81ba2e99151a14c178b33`. Fetching upstream again found no missing commits.
- All 3,386 frontend/sidecar tests passed, with eight real export tests run separately. The two remaining optional skips reflect happy-dom parser limitations. Format/lint, typecheck and production build passed.
- All 85 native tests passed with crash reporting compiled in. The real Secret Service credential round trip also passed separately.
- All four [GitHub CI jobs](https://github.com/AksharP5/remocn-studio/actions/runs/37019726180) passed for the release source, including a clean Ubuntu Linux build and vendored-skill verification.
- Fixed a missing GStreamer plugin scanner path in the AppImage. Native startup produced 197 plugin loader warnings before the fix and zero afterwards. The WebKit child inherited the actual bundled scanner path. The regression test preserves working defaults and custom paths.
- The patched native app played footage/audio and moving WebGL. Its 30.059-second MP4 export contained H.264/AAC at 1920 × 1080 and 30 fps, and matched the earlier verified export byte for byte.
- The installed app successfully applied the signed 1.0.1 → 1.0.2 update and restarted. The project document checksum stayed unchanged, and the installed AppImage matched release SHA-256 `59fb48f1ac7ab7336e596df5d2a64572c7b9bf61e5a766ea508504002c86a8eb`.
- Native shutdown exited cleanly and produced no new core dumps.

That audit used [v1.0.2](https://github.com/AksharP5/remocn-studio/releases/tag/v1.0.2). Follow-up screenshots are in the ignored `artifacts/linux-qa/audit-*` files.

## Recovery audit: 1.0.3

Rechecked on October 2, 2026:

- Reproduced temporary download directories left after HTTP failure and cancellation, and a checksum request that continued after cancellation. The installer now owns download cleanup through its scope and waits for cancelled IO to finish before releasing its semaphore. Cancellation stops subprocesses and preserves the existing runtime before activation.
- All 14 installer tests passed, including the full install, failed-download cleanup, cancelled streams, checksum cancellation and cancellation of a running verification process. An isolated real installation downloaded official Node.js `v24.21.0`, verified its release checksum, activated Node/npm and removed the download directory.
- All 3,391 local frontend/sidecar tests passed. Format/lint, typecheck, production build and signed AppImage packaging passed.
- All four [GitHub CI jobs](https://github.com/AksharP5/remocn-studio/actions/runs/37024869087) passed for release source `2568d6d`, including 85 native tests. CI passed 3,384 application tests; its additional seven skips require local Remotion/media fixtures and passed locally. The eight opt-in real renderer cases were verified in the previous audit; this patch changes Node.js setup.
- The new AppImage started on Omarchy, restored the QA project, played moving footage and WebGL, and quit with helper exit code zero. No new core dumps appeared.
- Corrected an extra base64 encoding in the release manifest before applying the update. The published signature matches Tauri's generated `.sig` text directly.
- The installed app applied the signed 1.0.2 → 1.0.3 update and restarted. Its SHA-256 is `f73504ab0a218bb904588afcbd0bae15ca08da4152f9db6491b5edc614089f07`, matching the release. The project document checksum remained unchanged.
- A final upstream fetch found no missing commits.

That audit used [v1.0.3](https://github.com/AksharP5/remocn-studio/releases/tag/v1.0.3). Recovery screenshots are in the ignored `artifacts/linux-qa/recovery-*` files.

## Editing and reload audit: 1.0.5

Rechecked on October 2, 2026:

- Fixed Linux canvas Ctrl+Z and video/chat Control deletion shortcuts. Native GTK Undo now offers the focused canvas its existing Undo handler, while text fields retain WebKit Undo. Regression tests cover both paths and both row types. In the packaged app, a heading nudge persisted x260 → x261 and Ctrl+Z restored x260. The video deletion dialog was opened and cancelled without removing the video.
- Reproduced native reload failure with looping audio. The error details were discarded by the native host; preserving them exposed Remotion's zero-length Loop error. A native probe isolated connected audio reporting duration zero, readyState 4 and networkState 1. The runtime now defers that metadata event until durationchange supplies a positive value, including Infinity. The packaged app retained the paused frame through nudge and Undo reloads, then played moving footage and WebGL without the error. Temporary probe changes were removed and the QA source checksum was restored.
- Fixed stale HOME package-manager shims overriding active PATH, including unusable files and directories. Managed npm discovery is tested immediately after installation and after activation on restart. Removed unnecessary archive setup from the checksum cancellation test and waited for the real preview-collapse transition in the page test.
- All 3,403 local application tests passed, with 10 optional skips. All eight opt-in real renderer cases passed, including WebGL, audio, MP4/H.264, WebM/VP9, MOV/ProRes, GIF and failed-export preservation. Format/lint, typecheck, static export and signed AppImage/deb packaging passed.
- All four [CI jobs](https://github.com/AksharP5/remocn-studio/actions/runs/37077396718) passed for release source `4b7558c`, including 85 native tests and 3,396 application tests. The additional seven CI skips require local fixtures and passed locally.
- The installed app applied the signed 1.0.3 → 1.0.5 update and restarted with helper protocol 38 and history schema 8. Its SHA-256 is `19bfa766a118184c4322e17dce8df0c755780014b17200a160c6a8a69dbfb78c`, matching the release. The project document checksum stayed unchanged through the update.
- A final upstream fetch found no missing commits.

The current Linux release is [v1.0.5](https://github.com/AksharP5/remocn-studio/releases/tag/v1.0.5). Native evidence remains in the ignored `artifacts/linux-qa/final-*`, `diagnostic-*` and `update-*` files.

## Account-dependent features

Provider subscriptions and optional Figma, ElevenLabs and Pexels credentials are supplied by the user, as in upstream. The upstream app's private bundled Pexels key is not part of its source; this fork supports a personal key in Settings. Provider protocol coverage is retained, including upstream's experimental status for Codex, Copilot and Grok. No claim of a live integration test is made without the corresponding account.

## Desktop differences

Omarchy has no macOS Dock. The waiting count and export status appear in the native window title, while the same unread markers, cards and opt-in notifications remain in the app. Linux Edit menu actions use WebKit for text and clipboard operations, while Undo follows the focused canvas. Linux editing shortcuts use Control. Linux provider setup commands explicitly include the managed Node.js bin directory, which also works when a terminal reuses an existing process.
