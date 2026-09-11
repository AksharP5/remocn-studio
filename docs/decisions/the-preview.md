# The preview

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`preview/live-preview`](../../openspec/specs/preview/live-preview/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


The pane runs **the project's own Remotion bundler with our entry instead of the Studio UI**.
Neither branch of #226 survived contact with a real project: a Vite host builds
`remocn-demo` without an error and emits 3 CSS class selectors where Remotion's
bundler emits 742, because `enableTailwind` is a splice of webpack *loaders*
(`style-loader`, `css-loader`, `@remotion/tailwind-v4`'s `@tailwindcss/webpack`)
and Vite cannot run those — it silently falls through to the project's
`postcss.config.mjs`, a different Tailwind with different source detection. And
Plan B was never necessary, because Remotion's webpack entry is an array whose
last element is a parameter:

```js
entry: [ fast-refresh, setup-environment, userDefinedComponent, react-shim, entry ]
```

`@remotion/studio/previewEntry` is only `Internals.waitForRoot((Root) => render(<Studio …/>))`.
Studio is a UI on top of the bundler, not part of it. `preview/entry.tsx` takes that
slot and mounts `<Player>` instead, so the pane is ours and the pixels are Remotion's.

- **There is exactly one way the pane is away, and that took a fix** (REM-332). The
  panel is `collapsible`, so react-resizable-panels collapses it when the divider is
  dragged past its own `minSize` — and that state is *not* `isPreviewShown`, which is
  what the header renders its toggle off. So one drag took the preview and every
  control that could bring it back: no toggle, and no Inspect / Snapshot / Export
  either, since those live in the preview's own header. The layout is persisted, so it
  survived a relaunch. `usePreviewCollapse` now asks the panel itself — `isCollapsed()`,
  the group's own answer rather than a pixel threshold — and folds a collapse it did not
  ask for into `hidePreview`, which is the state the toggle already knows. A collapse
  reported while the preview is hidden is our own `collapse()` echoing back and is
  ignored. It fires on mount too, which is what heals a layout already stored collapsed.
- **Everything is resolved from the project**, never bundled here:
  `BundlerInternals.webpackConfig` *and* `webpack` itself come from the project's
  `@remotion/bundler`, the override from its `remotion.config.ts` via
  `ConfigInternals.getWebpackOverrideFn()`, and the entry point from the CLI's own
  `findEntryPoint` (reached through `@remotion/cli/package.json`, since the exports map
  blocks the deep path) with `ENTRY_CANDIDATES` as the fallback. `@remotion/player` is
  always present — it is a dependency of `@remotion/cli` and of `@remotion/studio`.
- **The opened folder is not the Remotion root.** `remotionRootOf` climbs to the nearest
  `package.json` first, exactly as the CLI does, and the host `chdir`s there — otherwise
  opening `src/demos/some-scene` reports "no Remotion entry point" for a folder that is
  part of a perfectly good project. Entry candidates are searched from that root, never
  from the folder the user happened to pick.
- **Which composition plays is the *page's* decision, not the host's.** One host per
  project serves one bundle, and each pane opens its own video at `/?composition=<slug>`
  — so switching videos is a page load (hundreds of ms) rather than another ~7 s compile
  at 1.67 GB peak. `remocn_preferred` is still the mechanism, but it is now filled from
  the query string at *serve* time (`sidecar/preview/server.ts`) rather than fixed in
  `ServerOptions` when the host starts. With no `composition` asked for, the order is
  unchanged — `folder → Main → first` — which is what keeps a foreign project opened
  straight from disk behaving as it did.
- **The page posts the whole catalog, not just the pick.** `compositions` rides on the
  `composition` message beside `compositionId`, and it is the only thing that knows what
  the project really renders; the pane reconciles its SQLite rows against it. See
  *Project → video → chat*.
- **A video that was asked for and does not exist is said out loud, never substituted.**
  The page carries two globals, not one: `remocn_composition` — the video this page was
  opened for — and `remocn_preferred`, the basename guess from #226. A miss on the first
  is `reason: "missing"`, no Player mounts, the hint names the slug and the environment
  checklist fails; a miss on the second falls through to `Main → first` exactly as before.
  Merging them is what made a project whose `Root.tsx` predates the scan quietly play the
  *wrong video* — the pane asked for `torrens-motherboard`, nothing registered it, and
  `Main` played instead with nothing on screen to say so.
- **`webpackOverride` can be async.** `remocn-demo`'s is. Not awaiting it puts a `Promise`
  into the config, which fails without a useful message.
- **The host is a child process with `cwd` set to the project**, because config files
  routinely resolve paths against `process.cwd()` — Remotion's own loader does
  `process.chdir(remotionRoot)` for the same reason. `sidecar/index.ts` re-execs itself
  with `--preview-host`, so there is one bundle and one Tauri resource rather than two.
- **One host at a time, keyed by project** (see #235): sessions in one project compile a
  byte-identical bundle, so a host per session is two compilers on one tree. A full
  compile of `remocn-demo` costs ~7 s and peaks at 1.67 GB, and the webpack filesystem
  cache does not help, so hosts are not kept warm. A stopped host loses nothing: the next
  start compiles from disk, and a host left running would rebuild on every agent edit for
  a pane nobody is watching.
- **The webpack cache is off, and it is pinned off** (REM-318). `enableCaching` becomes a
  webpack filesystem cache that lands beside the nearest `package.json` — inside the
  person's project, at `node_modules/.cache/webpack`: 9 GB across four projects, never
  pruned, and corrupt on nearly every run, because stopping the preview kills the host
  mid-write and a truncated pack answers *Unexpected end of stream* for ever after (1066
  lines in one day's log). It bought nothing, by the measurement above. `BUNDLE_FLAGS` in
  `sidecar/preview/bundling.ts` holds the flag with a test on it. What is deliberately not
  done is deleting the caches already written: `npx remotion studio` uses the same
  directory, so the studio cannot tell its own bytes from the CLI's.
- **The base config already pins `react`, `react-dom/client`, `remotion` and
  `@remotion/studio` to absolute paths**, which is why `preview/entry.tsx` can live
  outside the project at all. `@remotion/player` is the one alias we add.
- `preview/` is **excluded from `tsconfig.json`**: it imports `remotion` and
  `@remotion/player`, which are deliberately not dependencies here. The linter still
  covers it, and `lib/studio/preview.test.ts` decodes the exact message the entry posts,
  which is the only guard against that boundary drifting.
- The stream is the lifetime: `preview.start` is a long-lived request and stopping it is
  a fiber interrupt, which drops the `acquireRelease` that owns the child. There is no
  `preview.stop`.
- **`building` after `ready` is normal** — `ProgressPlugin` reports 100% after the first
  compile finishes. `usePreview` ignores progress once served, or the pane would replace
  a live player with a spinner.
- **The preview follows the sidecar back up** (REM-324). Its request being the lifetime is
  what made a crash kill it correctly and then leave it dead: the supervisor had a new
  sidecar in ~3 s, the composer and the transcript were untouched, and the one pane costing
  7 s to rebuild was the only thing left needing a click on an unlabelled Restart button.
  `previewRecovery` in `lib/studio/failures.ts` is the whole rule — `restarting` and `down`
  mark it lost, and the next `ready` relaunches once. `starting` deliberately does not
  count: that is also a cold boot, where the effect that opens the preview has already run,
  and re-arming there would compile twice. Restart stays as the escape hatch for a re-arm
  that fails. The phase reaches `usePreview` from the provider, which takes **only the
  phase** and keeps it out of the studio context: putting the whole `Sidecar` in there
  changed the context value's identity on every status event and re-rendered every consumer
  for a reading one hook wants.
- **The pane never prints a protocol token.** `cancelled` is the sidecar's own reply frame —
  what `Effect.onExit` answers so a killed handler answers at all — and it reached the
  screen lowercase and red in an otherwise empty pane. A good protocol decision and a
  terrible sentence, and untrue besides: nobody cancelled anything, the process died.
  `previewFailure` words it.
- **A renderer's own text is worded, not forwarded** (REM-322). A failed `preview.still`
  printed the raw error: ~300 characters of percent-encoded `staticFile` URL, clipped
  mid-token because a URL is one unbreakable word, followed by Remotion's stock advice that
  *"this could be caused by Chrome rejecting the request because the disk space is low"*.
  That advice is written for a CI container, and it is not only the person it misleads —
  the agent read it in the transcript and spent a tool call on `df -h` before finding the
  real cause. `renderFailure` drops the advice and names the asset instead of its URL; the
  raw text is in `sidecar.log`, which already has it. The wrapping in the pane stays as
  insurance for whatever a renderer says next.
- **The static server answers byte ranges, and a video does not play without them.**
  Serving `public/` as one `200` with a chunked body and no `content-length` is enough for
  every image and font, and it is not enough for a `<video>`: the macOS webview probes with
  `Range: bytes=0-1` and abandons the element when the answer is not a `206`. Nothing
  reports that. `OffthreadVideo` renders `VideoForPreview` in the Player and defaults to
  `pauseWhenBuffering`, so a clip that never becomes playable shows up as a preview that
  loads for ever — a symptom that names neither the file nor the server. Remotion's own
  studio server does the same thing (`@remotion/studio-server`'s `serve-static.js`), which
  is why the same project plays under `npx remotion studio` and hung here. `sendFile` now
  sends `accept-ranges` and a real `content-length` always, `206` with a `content-range`
  for a range, `416` past the end and no body for a `HEAD`; `sidecar/preview/range.ts` is
  the pure parser, tested on its own, and an unreadable header is *ignored* rather than
  refused, as RFC 7233 requires.
- **A clip that leaves the DOM is released by hand** (REM-338). Playing a composition with
  footage grew the WebKit GPU process by 1.3–1.6 GB on *every* loop and gave none of it
  back until the page unloaded — 6.9 GB after four passes, on a 16 GB machine. The
  mechanism: `OffthreadVideo` previews through a plain `<video>` inside the scene's
  `<Sequence>`, which unmounts at the end of the composition and mounts again on the next
  loop, so every loop is a new element, and WebKit keeps a detached element's media player
  and its decoded frames until garbage collection, which a paused page does not run for a
  minute or more. Remotion's own unmount detaches its listeners and its audio node and
  nothing else. `releaseDetachedMedia` in `preview/media-release.ts` watches the preview
  root and, for a `<video>` or `<audio>` that is really gone once the DOM settles, clears
  the source and calls `load()` — the standard way to make WebKit tear the player down
  now. A node React merely moved is removed and inserted in one commit, so the check
  waits a microtask and asks `isConnected` first. The bytes going out again on each loop
  are a separate thing and not ours to fix: WebKit's media loader fetches ranges without
  conditional headers and its cache never stores partial responses, so no ETag on
  `public/` can turn a remount into a `304`. The footprint after four loops is the number
  to measure this by, in the running app.
- **`public/` revalidates, the bundle does not store.** `no-store` everywhere was the first
  version of the above and it is wrong for media specifically: the Player syncs a video's
  `currentTime` to the composition frame, so a scene is a stream of seeks, and a response
  the webview may not keep is one it has to refetch on each of them — plus the whole file
  again on every loop. Public files therefore carry `no-cache` and an ETag of size and
  mtime, which is a revalidation the agent's own edits invalidate for free; `If-None-Match`
  answers `304`, and a stale `If-Range` drops the range rather than splicing bytes from a
  file that has since changed. `bundle.js` and the render page keep `no-store`, where a
  cache hit surviving a rebuild is the failure that matters and there is no seeking to pay
  for. `sidecar/preview/caching.ts` holds the tag and the header parse, tested on their own.
