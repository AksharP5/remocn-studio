## Why

The app ships only macOS builds. On Omarchy, the bundled runtime has no Linux target, integration secrets use a mock credential backend, and native setup actions launch macOS programs. The fork needs the complete Remotion workflow on Linux.

## What Changes

- Ship the same editor, agents, library, preview and exports as a Linux desktop app.
- Use Linux credential storage, terminal launching, application data paths and native window actions.
- Install a missing Node.js runtime inside the app's own data directory on Linux.
- Build and install an AppImage with a desktop launcher and deep-link registration.
- Check signed updates from this fork's releases.

## Capabilities

Modified: shell/startup, shell/layout-and-panes, shell/attention, shell/quit-and-updates, shell/crash-reporting, projects/environment-checklist.

## Impact

Rust owns platform integrations. The sidecar owns managed Node.js and package-manager discovery. Existing webview hooks retain their workflows and choose supported platform actions. Packaging gains Linux targets. No history migration, IPC protocol change or new settings keys is planned.

## Non-goals

- HyperFrames support.
- A new editor architecture or a different visual design.
- Windows support.
