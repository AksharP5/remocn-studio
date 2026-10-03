# Linux / Omarchy

This fork keeps the Remotion editor and adds Linux native integrations. The original macOS source remains available through the `upstream` remote.

## Install

Download the AppImage from [this fork's releases](https://github.com/AksharP5/remocn-studio/releases). From the repository, run:

```sh
bash scripts/install-linux.sh /path/to/Remocn_Studio.AppImage
```

The app is installed in `~/.local/share/remocn-studio`, with `~/.local/bin/remocn-studio` and an application launcher. The launcher uses `GDK_SCALE=1` so Omarchy's global GTK scale does not double this X11 app on the tested 1080p display. From a terminal, use `GDK_SCALE=1 remocn-studio` for the same size. Desktop scaling stays unchanged. The desktop entry handles `remocn-studio://` template links. App data lives in `${XDG_DATA_HOME:-~/.local/share}/io.github.aksharp5.remocn-studio`.

Integration keys are stored in the desktop's Secret Service. Omarchy's unlocked GNOME Keyring supplies this on the tested machine. Provider sign-in continues to use the installed Claude, Codex, Copilot or Grok CLI. The app never pastes or runs a setup command in the terminal for you.

To use Codex, choose **Codex → Default** from the model menu beside the message field. Studio uses the Codex CLI's existing sign-in. Saved Codex conversations retain their provider and can resume after restarting the app. New chats and projects start with Claude, so select Codex again there. Codex remains experimental upstream; its context meter, structured plan checklist and interactive approval cards are not available in Studio.

## Build

GTK 3, WebKitGTK 4.1, libsecret, OpenSSL, librsvg, patchelf, Rust and Bun are required. On Omarchy these development libraries are already present on the tested machine. AppImage execution requires FUSE; Omarchy includes it.

```sh
bun install --frozen-lockfile
bun run linux:build --no-sign
bash scripts/install-linux.sh
```

The build automatically downloads the Bun version pinned in `package.json`. Linux editing shortcuts use Control. Native Undo follows the focused canvas; text and clipboard actions use WebKit, including on Wayland. If Node.js is missing, Install Node.js installs the official LTS runtime within app data after verifying its checksum, without changing system packages or shell configuration.

## Signed updates

`linux:build` disables linuxdeploy's old symbol-stripping tool, which cannot read Arch's RELR library sections. Rust's release binary is already stripped. The setting affects packaging only and follows [linuxdeploy's supported NO_STRIP option](https://github.com/linuxdeploy/linuxdeploy/issues/72).

Linux checks this fork's `latest.json` and verifies downloads with its own public signing key. The private key is kept outside the repository, under `~/.local/share/remocn-studio-signing` on the maintainer's machine. Build a signed release with:

```sh
TAURI_SIGNING_PRIVATE_KEY="$HOME/.local/share/remocn-studio-signing/linux.key" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD='' \
bun run linux:build
```

Publish the AppImage, its signature and the Linux updater manifest together. The installer uses a stable AppImage path so an in-app update replaces the installed file and restarts into the new version. The upstream macOS publishing workflow runs only in the upstream repository.

Copy the `.AppImage.sig` file's text directly into the manifest's `signature` field. Tauri already base64-encodes that file; encoding it again makes the updater reject the release.

## Verification

The port's verification record is maintained in [linux-parity.md](linux-parity.md). Existing projects and exports keep their standard Remotion formats. HyperFrames support is outside this port.

The app defaults to WebKit's fallback compositing renderer because its DMABuf path left the editor blank on the tested Omarchy NVIDIA desktop. This is the workaround documented in [WebKit issue 291332](https://bugs.webkit.org/show_bug.cgi?id=291332); it does not change Remotion's Chromium export renderer. An existing `WEBKIT_DISABLE_DMABUF_RENDERER` setting is respected.

On Linux with the NVIDIA kernel module loaded, the app selects the system Mesa EGL vendor when `/usr/share/glvnd/egl_vendor.d/50_mesa.json` exists. This avoids the NVIDIA EGL crash on shutdown observed here and reported with the same WebKitGTK version in [NVIDIA's developer forum](https://forums.developer.nvidia.com/t/egldestroycontext-segfault-in-libnvidia-eglcore-580-branch-during-ordinary-gl-context-teardown-likely-same-class-as-bug-5701801/382969). WebGL2 rendering, video and audio previews, and clean shutdown were verified on the Omarchy setup. An existing `__EGL_VENDOR_LIBRARY_FILENAMES` setting is respected. This changes the app's environment; it does not change system configuration.

The Arch AppImage contains its media plugin scanner under `usr/lib/gstreamer-1.0`, while linuxdeploy's hook expects an additional `gstreamer1.0` directory. Studio repairs that specific missing bundle default before GTK starts. Working scanner paths and custom settings are preserved; system installations are unaffected.

Agent commands use the host's Python. Studio removes AppImage bundle paths from the helper's `PYTHONHOME` and `PYTHONPATH`, preserving configured host paths. This prevents the bundle launcher from redirecting Python to a missing standard library.
