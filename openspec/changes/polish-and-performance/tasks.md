## 1. Quick wins

- [x] 1.1 `--font-mono` resolves to Geist Mono instead of referring to itself (`app/globals.css:206`)
- [x] 1.2 No "session" or "composition" in user-facing text: chat header, delete toast, model menu, permission card, settings, update status, export stages, environment rows, the recorder's fallback title; the updates copy stops promising a daily check; the animated badge tells the truth for keyframed keys
- [ ] 1.3 The splash's 50 ms tick re-renders only the splash, not the shell
- [ ] 1.4 fast-check is aliased out of the client bundle
- [ ] 1.5 `lib/studio/design-review.ts` moves from zod to Effect Schema and zod leaves the webview bundle
- [x] 1.6 The title bar shader stops drawing while the window is unfocused

## 2. Webview responsiveness

- [ ] 2.1 The studio context is split so a streamed token or a keystroke does not re-render the sidebar, the preview or the title bar
- [ ] 2.2 Sidebar groups keep their identity unless a row's status changes
- [ ] 2.3 Streamed deltas commit at most once per animation frame
- [ ] 2.4 Only the seek bar and timecode subscribe to the playing frame; `seekTo` is stable
- [ ] 2.5 Camera pan, zoom and tweens write the transform through a ref during a gesture and commit state at its end
- [ ] 2.6 The transcript reuses settled runs instead of regrouping every entry per token

## 3. Sidecar, preview host and core

- [ ] 3.1 design-progress travels as a frame, not through the redirected stdout
- [ ] 3.2 The render-only bundle drops HMR, React Refresh and progress plugins and cleans its output
- [ ] 3.3 The native compile starts with the host instead of after the main compile's ready
- [ ] 3.4 Account probes run concurrently, share an in-flight probe and paint from the last result
- [ ] 3.5 A provider switch re-probes only the account row; lockfile drift is cached by file fingerprint
- [ ] 3.6 An export opens one browser for measuring and rendering, and trusts the render-config fingerprint
- [ ] 3.7 A turn's tool servers cost one process, and re-exec'd children load only their own module graph
- [ ] 3.8 The render compiler is suspended between renders (REM-535, `canvas-follow-ups` 2.2)
- [ ] 3.9 The warm render browser closes after it has been idle
- [ ] 3.10 Preview output folders of unknown projects are pruned at start
- [ ] 3.11 File-writing and process-spawning Tauri commands run off the main thread
- [ ] 3.12 Copilot and Grok keep one ACP peer per chat with an idle timeout
- [ ] 3.13 Webpack progress is sent only when the whole percent changes
- [ ] 3.14 `library.offer` hashes by stream and compares sizes first
- [ ] 3.15 The recorder persists streamed text at a bounded rate and at block end
- [ ] 3.16 The sidecar log rotates by size while running

## 4. Look and feel

- [ ] 4.1 Failures read as sentences with a Details disclosure and Copy details, never `JSON.stringify` or `Error: …`
- [ ] 4.2 Projects, videos and chats have native context menus; the webview's own menu is suppressed outside text
- [x] 4.3 Preview build progress shows a bar and the frame fades in
- [x] 4.4 Export results can be dismissed, failures retried and copied, and a long render asks before cancelling
- [x] 4.5 Copy names the active provider instead of always saying Claude
- [x] 4.6 One user-facing word for the sidecar
- [x] 4.7 Motion tokens for easing and duration in `@theme`, used across the studio
- [x] 4.8 Reduced motion covers the toast shake and bounce, the easing preview, the title bar filter and the drop zone spinner
- [ ] 4.9 Settings, notice cards and preview status rows enter and leave with a transition
- [x] 4.10 Buttons use the default cursor and fade their hover background
- [x] 4.11 One tooltip system with shortcut hints; the Pan tool has one
- [x] 4.12 Status colours come from tokens and read in light mode; "running" has one look
- [x] 4.13 One floating-surface recipe
- [ ] 4.14 A New Chat command with a shortcut; rows can be renamed and deleted from the keyboard
- [x] 4.15 Layers and docs show skeletons; the transcript skeleton looks like messages
- [ ] 4.16 Scaffold install shows elapsed time, can be cancelled and words its failure
- [ ] 4.17 Small things: the inspector shows the video's name, `--text-2xs` instead of arbitrary sizes, the onboarding save error uses the toast system, the window background matches the theme, consistent labels, the export dialog warns only when the file exists, the transport sliders match the seek bar

## 5. Bundle and memory

- [ ] 5.1 dialkit, Streamdown with the Shiki core, and Sentry load when first needed
- [ ] 5.2 Golos is not preloaded, Inter leaves the main route, `app/lab/*` stays out of the production export
- [ ] 5.3 Idle transcripts are released from memory and reloaded on open
- [ ] 5.4 The transcript shows posters instead of live video; images load lazily

## 6. Splash

- [x] 6.1 The splash minimum is shortened to the length of its draw, with the delta spec for `shell/startup`

## 7. Verification

- [ ] 7.1 `bun run check`, `bun run typecheck`, the full `bun run test`, `cargo check`, `cargo check --features crash-reports`, `bun run build`
- [ ] 7.2 In the running app: right-click in the webview, dragging the window by the chat title, the window background while resizing in light mode
