# Linux parity verification

Target: Omarchy 4, x86_64, Hyprland/Wayland, WebKitGTK 4.1. The port retains the upstream editor and Remotion project format. No HyperFrames integration is included.

| Workflow | Evidence |
| --- | --- |
| Editor, preview controls, properties, geometry, text, easing, undo | Existing editor tests retained; native app verification pending below |
| Claude, Codex, Copilot and Grok adapters | Existing provider tests retained; launcher PATH includes mise and local binaries |
| Provider setup | Linux terminal opens without executing the copied command; shell tests verify managed Node PATH and quoting |
| Node.js setup | Official Linux archive, SHA-256 verification, immediate/restart discovery, failed-download preservation and incomplete-install repair tests |
| Integration credentials | Real encrypted Secret Service write/read round trip passed |
| Native menus | Linux actions use WebKit editing commands and supported window APIs; native contract tests passed |
| Attention | Linux title count/progress and notification action tests passed; no Unity Dock dependency |
| Crash privacy | XDG consent path and Linux home-path scrubbing tests passed; reports remain opt-in |
| Rendering | Real DOM/SVG/text and moving WebGL2 frames passed |
| Export formats | Real MP4/H.264, WebM/VP9, GIF and MOV/ProRes passed, including audio preservation, computed metadata, odd sizes and 720p scaling |
| Packaging and updates | Fork signing key/endpoint, stable installed AppImage path and desktop scheme registration; runtime verification pending |

## Native app checks

These checks must be completed against the installed AppImage, outside the source checkout's development runtime:

- [ ] Launch from the installed desktop entry and confirm the bundled sidecar becomes ready.
- [ ] Open the QA project and play/scrub its native preview, including footage and audio.
- [ ] Inspect and edit text/properties, then undo and redo.
- [ ] Verify native clipboard actions, file dialogs, project navigation, library and settings.
- [ ] Export from the app and inspect the resulting video.
- [ ] Verify terminal launching and a clickable system notification.
- [ ] Verify a signed in-app update and retained project/history data.

## Account-dependent features

Provider subscriptions and optional Figma, ElevenLabs and Pexels credentials are supplied by the user, as in upstream. The upstream app's private bundled Pexels key is not part of its source; this fork supports a personal key in Settings. Provider protocol coverage is retained, including upstream's experimental status for Codex, Copilot and Grok. No claim of a live integration test is made without the corresponding account.

## Desktop differences

Omarchy has no macOS Dock. The waiting count and export status appear in the native window title, while the same unread markers, cards and opt-in notifications remain in the app. Linux Edit menu actions operate directly on WebKit so clipboard actions work on Wayland. Linux provider setup commands explicitly include the managed Node.js bin directory, which also works when a terminal reuses an existing process.
