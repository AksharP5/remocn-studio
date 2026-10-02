## Evidence

The target machine is Omarchy 4 on x86_64 with Hyprland and Wayland. GTK 3, WebKitGTK 4.1, libsecret, Rust and xdg-terminal-exec are already installed. The source pins Bun 1.4.2 but maps only Apple targets. keyring enables only apple-native, which leaves Linux using a mock backend. The Node.js installer downloads a .pkg and executes /usr/bin/open.

## Decisions

- Retain the existing Tauri, Next static export and Bun sidecar architecture. Use platform branches only at native boundaries.
- Keep macOS credentials native; persist Linux credentials through Secret Service. A missing or locked service must surface a useful error rather than silently retaining a secret in memory.
- Open the configured Linux terminal without executing the copied setup command.
- Install official Linux Node.js archives in the app data directory. Verify the release checksum before extraction, then prepend its bin directory to the sidecar's PATH so installation survives app restarts. Do not change shell configuration or replace the user's system Node.js.
- Use AppImage for Omarchy, with installation under the user's local application directory. Keep desktop files and icons in XDG locations.
- Give the fork its own updater key and endpoint; never accept upstream updates that would replace the Linux port. Keep the private signing key outside the repository.
- Preserve all project formats and Remotion rendering paths. Verify real renders and the installed native app, including media, editing and export.

## State and failures

The sidecar owns the managed runtime on disk. The Rust core owns app data and native launch actions. Existing requests carry installation progress and errors; no wire change is required. Installation failure keeps the prior runtime and reports the reason in the checklist. Native integration failures remain visible. Credentials, app history and crash consent stay local. Platform limitations in desktop badge support are reported in the parity record.
