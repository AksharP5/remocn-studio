## Why

Three read-only audits on 2026-09-26 (REM-571) found that the studio feels slower
and rougher than it is. The largest cost is React work, not bundle size: every
streamed token and every keystroke re-renders almost the whole shell. 200 streamed
tokens cost 1095 ms of React work, and only 231 ms of that is the markdown that
actually changed. The preview host keeps HMR output nobody reads (1.4 GB,
19 040 hot-update files) and copies it into every export. `design_check` progress
never reaches the supervisor and makes up 96% of the sidecar log. The interface
still shows words the vocabulary forbids and raw error text, renders every mono
string in the sans face, and has no context menus.

## What Changes

- Webview responsiveness: the studio context split so a token re-renders the
  transcript and not the shell; sidebar groups, playback frames, camera gestures
  and transcript runs stop fanning out; streamed deltas are coalesced.
- Sidecar and core: design-progress travels as a frame; the render-only bundle
  drops HMR and cleans its output; the two compilers overlap; account probes run
  concurrently and are cached; an export opens one browser; tool hosts, the warm
  browser, ACP peers and old preview outputs stop costing when idle; file-writing
  Tauri commands leave the main thread; the render compiler is suspended between
  renders (REM-535).
- Look and feel: the mono font, the vocabulary, worded errors with details,
  context menus, build progress, dismissable export results, provider-neutral
  copy, motion tokens and reduced-motion coverage, one tooltip system, token
  status colours, one floating-surface recipe, a New Chat command, skeletons.
- Bundle and memory: fast-check and zod out of the bundle; dialkit, Streamdown,
  Shiki and Sentry loaded when needed; lab routes out of the export; idle
  transcripts released; posters instead of live video in the transcript.
- The splash minimum is shortened.

## Capabilities

### Modified Capabilities

Delta specs under `specs/` name each capability whose observable behaviour moves;
pure performance work carries no delta.

## Non-goals

- The webpack filesystem cache stays off (REM-318).
- No telemetry or analytics (REM-11 is declined).
