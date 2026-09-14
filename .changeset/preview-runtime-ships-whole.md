---
"remocn-studio": patch
---

The packaged app ships the whole preview runtime again: 0.8.0 left two of its
files behind, so every project's preview failed to compile on a clean install.
That failure is readable now too — the pane keeps the compile error on screen
instead of letting webpack's trailing progress tick paint "100%" over it, and
the error is written to `sidecar.log`.
