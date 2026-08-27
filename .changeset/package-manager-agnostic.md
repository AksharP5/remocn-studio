---
"remocn-studio": minor
---

Ship the bun runtime, and install each project with its own package manager.

The app used to need bun on the machine to start at all — no bun, no sidecar, and
so no chat, no history, no preview, and not even the checklist that would have
explained it. bun now rides in the bundle as a Tauri external binary, so the only
thing the studio still asks for is a Claude Code you are signed in to.

The other half is that bun is no longer everybody's package manager. `pmOf` reads
the project's lockfile — npm, yarn, pnpm or bun — and the scaffold, the Install
button and the "not installed yet" line in an asset brief all follow it, so
opening a project with a `package-lock.json` no longer earns it a second
lockfile. A project whose manager is not installed says so, and offers to install
Node.js for you.
