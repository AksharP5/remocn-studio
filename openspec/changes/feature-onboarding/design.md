## Context
Six supplied H.264 recordings are 1990×1080, silent, 11–38 seconds long, approximately 21 MiB total. Their frames were inspected to verify chapter mapping. Static Next export serves the desktop webview.

## Goals / Non-Goals
Ship the previously approved dialog using real media, with no dependency on Desktop paths or network. Do not teach basic chat or include REM-398.

## Decisions
- Use existing Base UI modal primitives, a six-item chapter list and one mounted native video. Native controls provide playback, seeking and fullscreen without duplicate custom buttons.
- Remux recordings without re-encoding, stripping metadata and moving the MP4 index to the front. Extract local JPEG posters. Larger application bundle is preferable to offline failures or third-party hosting.
- Pure catalog in lib/studio/onboarding.ts, lifecycle in use-onboarding, playback in use-onboarding-video. Components render hook state.
- Webview owns the `onboarding` setting with `dismissed` and `chapter` fields; old `toursSeen` does not suppress the new introduction. Unknown chapters fall back to Inspect. No protocol bumps or history migrations.
- Auto presentation waits for settings, project, idle work and absence of blocking surfaces. Explicit Settings entry opens above Settings and returns focus to its button. A new blocker temporarily hides an automatically opened overview without recording dismissal. An explicit request from Settings takes precedence so help remains available even during setup problems.
- Persist dismissal and chapter together through serialized writes; report save failures with a retry action rather than silently promising persistence.
- Respect reduced motion with poster/manual play; stop playback on unmount and preference changes. Rejected autoplay retains manual controls. Errors show a poster, short retry message and always-usable chapter navigation.

## Risks / Trade-offs
- Browser DOM tests cannot prove macOS webview playback: verify real playback/fullscreen and focus in the running app.
- Recordings show real app UI and are shipped as provided; no scene changes.
- Bundled media increases download size by approximately 21 MiB.

## Migration Plan
New and existing installations get one overview independent of old tip answers. Closing opts out of future auto display; Settings always reopens the last chapter. Remove old tip renderer, hook, catalog and their obsolete tests.

## Verification
- `bun run fix`, `bun run typecheck`, `bun run check`, focused tests and `bun run build` passed.
- The repository's `bun run test` command passed: 2,853 tests, 11 skipped, zero failures. A separate plain `bun test` run encountered shared test-state failures and was stopped; the prescribed parallel test runner passed.
- All six exported MP4s have exactly one video stream and no audio. All six posters and videos in the static export match their source hashes.
- DOM tests cover modal focus, Escape, outside clicks, Settings re-entry, persistence, media failure and reduced motion. Real macOS webview playback/fullscreen and visual checks at small window sizes remain manual checks; no development server was started.

## Visual revision
Following user review, cap the dialog at 896px, reduce padding and use a single 16px heading. Remove eyebrow, explanatory copy, numbered instructions, duration captions and duplicate playback controls. Keep a neutral selected chapter background with foreground text and consistent weight; use a compact chapter selector below the desktop breakpoint. Retain native video controls, failure retry, navigation and persistence.

## Motion
Use CSS transitions for a 240ms modal entrance with a shorter 150ms exit, an interruptible 240ms chapter highlight, and a 200ms incoming-video fade with an 8px directional hint. Only one video is mounted; there is no delayed media teardown or overlapping playback. Keyboard chapter changes are instant. Reduced motion removes translation and scale while retaining a short fade. Do not stagger the initial content or delay interaction.
