---
"remocn-studio": patch
---

Use the active package-manager PATH before home-directory fallbacks and skip files that cannot be executed, so stale npm shims do not override the managed Node.js runtime.
