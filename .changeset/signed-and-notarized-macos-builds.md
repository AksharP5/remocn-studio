---
"remocn-studio": patch
---

macOS builds are now signed with a Developer ID and notarized by Apple, so
the app opens on first install without the "developer cannot be verified"
dialog and the right-click workaround. The bundled bun runtime keeps the
five hardened-runtime entitlements it ships with, so the sidecar starts
under the new signature exactly as before, and the `.dmg` itself carries a
notarization ticket as well as the app inside it.
