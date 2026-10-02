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

## Account-dependent features

Provider subscriptions and optional Figma, ElevenLabs and Pexels credentials are supplied by the user, as in upstream. The upstream app's private bundled Pexels key is not part of its source; this fork supports a personal key in Settings. Provider protocol coverage is retained, including upstream's experimental status for Codex, Copilot and Grok. No claim of a live integration test is made without the corresponding account.

## Desktop differences

Omarchy has no macOS Dock. The waiting count and export status appear in the native window title, while the same unread markers, cards and opt-in notifications remain in the app. Linux Edit menu actions operate directly on WebKit so clipboard actions work on Wayland. Linux provider setup commands explicitly include the managed Node.js bin directory, which also works when a terminal reuses an existing process.
