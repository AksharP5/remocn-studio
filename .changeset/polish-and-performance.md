---
"remocn-studio": minor
---

The studio looks and feels more finished, and costs less while it works:
- Failures read as sentences, with the raw text behind Details and a Copy details button. Mono text is set in Geist Mono again, and the interface no longer says "session", "composition" or "sidecar".
- Videos and chats have native right-click menus. New Chat is on ⌘T, F2 renames a video and ⌘⌫ deletes a row.
- The preview shows a progress bar while it builds and fades the frame in. The export pill shows its stage, a long render asks before it stops, a finished export can be dismissed and a failed one retried.
- Motion, status colours, tooltips and floating cards share one set of tokens. The splash leaves as soon as its draw has landed, the window matches the theme, and the title bar shader rests while the window is in the background.
- The canvas compiler alone gets the preview ready. The render bundle is built only when a render needs it, without hot-reload output, and old preview folders are pruned at start.
- An export measures and renders in one browser. Claude's tool servers run inside the helper, Copilot and Grok keep their agent between turns, and account checks run at once and answer from the last sign-in.
- Streamed text is saved a few times a second instead of on every token, the log rolls over while the studio runs, and saving a pasted picture no longer holds up the window.
