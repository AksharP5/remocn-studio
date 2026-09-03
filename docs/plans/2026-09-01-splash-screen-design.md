# Splash screen design

## Goal

Launching the studio today shows a white window for up to a second, then an
empty dark rectangle, then — for a person who already has projects — the
onboarding screen for a few hundred milliseconds before the transcript takes
its place. Replace those three moments with one: a dark window that appears
already painted, the brand mark drawing itself in while the sidecar starts,
and one dissolve into the shell once the shell is what it will stay.

The splash lives **inside the main window**, not in a second Tauri window.
Boot is about a second; a separate window that closes as the main one opens is
a jump cut, and the whole point is that nothing cuts.

## What the first second is made of, measured

- **The window is shown before the webview has painted.** `tauri.conf.json`
  sets neither `visible: false` nor `backgroundColor`, so macOS shows a window
  whose background is the system window colour — white under a light system
  appearance — until the first paint. In a debug build the Next dev server's
  first compile stretches this to seconds.
- **The first paint is a dark rectangle, and it is already in the HTML.**
  `StudioProvider` renders `<div class="h-full bg-background">` until settings
  hydrate, so the static export carries it (measured in `out/index.html`), and
  next-themes' inline script stamps `.dark` before the render-blocking
  stylesheet lets the page paint. Nothing white comes from the page itself.
- **The sidecar answers `ready` ~0.6 s after spawn** (from `sidecar.log`:
  `starting` 20:39:47.94 → `ready` 20:39:48.58, and 20:34:07.82 → 20:34:08.38).
  `project.list` waits on that, so `isLoadingProjects` stays true for roughly
  0.7–1.0 s after launch.
- **The onboarding flash is a missing guard.** `ChatPane` derives
  `isStartup` from `hasProject`, and `projects` is `[]` until `project.list`
  answers, so a returning person sees `Startup` for the length of that wait.
  Nothing in `chat-pane.tsx` reads `isLoadingProjects`.

## The sequence

Four moments, one continuous surface. Times are from the first frame the
window is visible.

1. **Reveal (0 ms).** The window becomes visible only after the splash has
   painted. Background is the `--sidebar` token — the shell's outermost
   surface — so the dissolve at the end changes nothing at the edges.
2. **Draw (0 → 700 ms).** The "r" glyph from `logo-mark.tsx` is a
   *self-drawing stroke*: `pathLength="1"`, `stroke-dasharray: 1`,
   `stroke-dashoffset` animated 1 → 0 with `cubic-bezier(0.22, 1, 0.36, 1)`
   (the `card-in` curve already in `globals.css`, so the splash speaks the
   app's own easing). At 75 % of the draw the fill *crossfades* in over
   250 ms while the stroke fades out — one motion, not a draw followed by a
   fill.
3. **Wordmark (420 → 770 ms).** "emocn Studio" is revealed by a `clip-path`
   inset wipe from the left, 350 ms `ease-out`, with a 6 px travel on X. It
   starts while the glyph is still drawing — one *orchestrated* wave, never a
   *layered entry* where the mark finishes and then the letters begin. The
   travel is on X because `video-lessons` §2 says a text entrance travels on
   X: a Y entrance snaps glyph baselines.
4. **Hold.** Once React has mounted, the `ShaderField` (the same NeuroNoise
   the Startup screen and the titlebar use) fades in behind the lockup over
   900 ms `ease-out` — the `titlebar-in` keyframes, reused. Its drift is the
   liveness signal for as long as the hold lasts. Nothing pulses:
   `video-lessons` §1 bans it, and the field already moves.
5. **Leave (650 ms).** The splash surface holds almost fully opaque through
   the first 10% (`1 → 0.96`), then dissolves to 0 with a gentle `ease` curve.
   In parallel, the lockup scales from `1 → 0.86` over 600 ms with
   `cubic-bezier(0.25, 0.46, 0.45, 0.94)`. The shorter travel and softer curve
   keep the retreat readable without the previous snap. The transform is
   deliberately on the lockup rather than the full-window shader surface: the
   logo remains readable and the WebGL layer only has to composite opacity.
   The shell is already rendered underneath; it gets no entrance of its own —
   one entrance per container. The titlebar band's existing `animate-titlebar`
   fade is the only motion under it, and it is already there.

**Reduced motion.** No draw and no wipe: the filled glyph and the wordmark
fade in over 150 ms (`titlebar-in`), the exit is a 150 ms opacity fade with no
scale and no blur, and the shader is still — `useShaderBackdrop` already
answers `speed: 0` for it. The splash still appears and still leaves: a
change that reads as a change, degraded, not deleted.

## When it leaves

`splashPhase` in `lib/studio/splash.ts` is a pure function over
`{ shownAt, now, isSettled, isReduced, cap }` and decides everything; the
component renders its answer and decides nothing.

- **Settled means the shell will not change under the dissolve**: settings
  hydrated, `project.list` and `history.sessions` answered, and the active
  project's first `video.list` answered (success or failure). A
  project-specific readiness marker closes the render where
  `isLoadingVideos` is still false before its effect starts. That kills the
  onboarding flash, the skeleton-to-row swap, and late session rows under the
  dissolve. Once settled, the hook waits another 150 ms so downstream preview
  state can reach `building` before exit.
- **The splash is the only entrance container.** While it is mounted, the
  shell's sidebar, preview, handle, and inset-card layout transitions are
  forced to zero duration. The freeze ends only after the splash's own
  `animationend`, so the shell is already in its final geometry when exposed.
  A preview iframe that becomes ready under the splash records that fact and
  does not replay `stage-in` afterward. The iframe itself remains transparent
  until its `load` event, then uses one 200 ms opacity transition; the initial
  titlebar mood likewise skips its entrance when mounted under the splash.
- **A transient empty composition registry is not UI state.** Remotion mounts
  its composition provider with `initialCompositions=[]` before the project
  root registers the real entries. `usePreview` holds that shared message for
  250 ms and cancels it when the populated registry arrives, so the chat,
  player, and sidebar never render the false empty-project state. A genuinely
  empty project remains empty for the settle window and is still published.
- **The draw is never cut.** `MIN_SHOWN` is 1 500 ms from reveal, so a fast
  machine still sees the whole stroke, the wordmark land and a short hold. Below the
  *trackability threshold* an animation reads as a flicker, and a glyph that
  is 60 % drawn when it dissolves reads as a mistake.
- **A dead sidecar does not hold the window hostage.** `CAP` is 6 000 ms: past
  it the splash leaves whatever the state, because the shell already has the
  UI for a sidecar that is down or restarting, and that UI is the honest thing
  to show. Under the cap, a sidecar in its restart backoff simply lengthens the
  hold, with the field drifting.
- **The phase is derived, not scheduled.** `useSplash` keeps `shownAt` in a
  ref, ticks with the same `useNow` the pane's timers use, and stops ticking
  once the phase is `gone` — an idle window must not repaint for a splash that
  is no longer there.

## Where it lives

- **`components/studio/splash.tsx`** is markup and classes only — no hooks, no
  client state — so `AppShell` can render it on the server and it lands in
  `out/index.html`. That is what makes it paint before React: the dark
  surface and the glyph are there on the first frame, and the CSS draw starts
  the moment the page is visible. `StudioProvider`'s not-ready branch renders
  nothing, since the splash now covers it from `AppShell`.
- **`hooks/use-splash.ts`** owns the phase, reading `workspace.isReady`,
  `isLoadingProjects` and reduced motion; it adds `data-splash="leaving"` to
  the element on the way out and unmounts it on `animationend`.
- **`app/globals.css`** gains `splash-draw`, `splash-fill`, `splash-wordmark`
  and `splash-out` keyframes beside the existing set, plus their
  reduced-motion overrides in the block that already handles
  `.animate-titlebar`.
- **`logo-mark.tsx`** exports `GLYPH` so the splash draws the same path the
  wordmark renders, rather than a second copy of 1 200 characters of path
  data. The two are then one constant, and a redrawn logo cannot leave the
  splash spelling the old one.

## The window

- **`visible: false` in `tauri.conf.json`**, and a `reveal_studio` command in
  `src-tauri/src/commands.rs` that calls `show()`. The webview asks for it
  from a tiny inline script — `beforeInteractive`, in `app/layout.tsx` — on
  the second `requestAnimationFrame` after `DOMContentLoaded`, i.e. after the
  splash has painted. The script is guarded on `__TAURI_INTERNALS__`, so
  `bun dev` in a plain browser is unaffected. A Rust-side command rather than
  `core:window:allow-show` on the capability keeps window visibility in the
  core, next to `quit_studio` and `restart_studio`.
- **A window that is never asked for is still shown.** `setup` spawns a
  1 500 ms fallback that shows the window if nothing has yet: a page that
  failed before the script ran must surface as a broken page, not as an app
  that launched into nothing. `show()` is idempotent, so the two paths cannot
  fight.
- **`backgroundColor` is set to the dark `--sidebar` value** (≈ `#111111`,
  `color-mix(neutral-950 97 %, white)` — compute it from the token at
  implementation and record the number). With `visible: false` it no longer
  matters for launch; it is what fills the gap during a live resize, and the
  default theme is dark. Following a light theme at runtime is
  `set_background_color` on the window once next-themes has resolved, and it
  is a follow-up, not part of this.

## Deliberately not done

- **A shared element transition from the splash lockup into the Startup
  header's `LogoWordmark`.** It would be the most beautiful version — the
  mark travels to where it lives — but the target sits inside a scroll
  viewport whose geometry depends on the window and the sidebar's collapse
  state, it exists only for a person with no projects, and it would need
  `motion` to take over a DOM node React hydrated from static HTML. The
  crossfade is the v1; this is its own piece of work if the first one earns
  it.
- **A second Tauri window.** See *Goal*.
- **Progress or status text on the splash.** The shell has the sidecar status
  UI; a splash that starts explaining itself is a splash that stayed too long.

## Verification

- `lib/studio/splash.test.ts` pins the phase machine: settled-but-early holds
  until `MIN_SHOWN`; late-but-drawn leaves at settle; `CAP` leaves unsettled;
  reduced motion skips `drawing`.
- `hooks/use-splash.test.tsx` pins the 150 ms quiet period, and
  `hooks/use-videos.test.tsx` pins the no-project-ready to active-project-pending
  handoff that previously exposed the loading race.
- `hooks/use-preview.test.tsx` pins both sides of the composition settle
  window: empty-then-populated is never published, while a stable empty
  registry is. `hooks/use-reconciled-videos.test.tsx` checks that each
  stabilized registry is reconciled once.
- `components/studio/splash.test.tsx` renders the markup and checks the
  reduced-motion data attribute and that the glyph carries `pathLength="1"`.
- `bun run build`, then `grep -c 'data-splash' out/index.html` — the splash
  must be in the static export, or it paints after hydration and the whole
  design collapses to a dark rectangle again.
- `cargo check` for the command and the fallback.
- **In the running app, by hand**: launch under a light system appearance and
  confirm no white frame; launch with a project open and confirm the
  onboarding screen never shows; kill the sidecar binary before launch and
  confirm the window appears within the fallback and the status UI is what is
  under the splash when it leaves; System Settings → Reduce Motion and
  confirm the fades.

## Documentation

A `### The first second` section in `CLAUDE.md` under *Architecture*,
recording the four measurements above, why the splash is in the static HTML,
why the window is hidden rather than coloured, and the two guards on leaving.
