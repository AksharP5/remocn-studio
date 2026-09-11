# Taking a picture of the frame, and sending it

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`preview/snapshot`](../../openspec/specs/preview/snapshot/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


Snapshot: pause, click the frame for the whole thing or drag a rectangle for part of it, and
the pixels land in the composer as an ordinary attachment with an `[Image #N]` token (#21).
It answers *look at this*, where Inspect answers *change this*, which is why the two are
separate buttons and mutually exclusive rather than one mode with a switch.

- **A snapshot is a `PromptAttachment` and nothing new.** The feature adds a way to *create*
  one; `shared/ipc.ts`, the transcript fold, the history store, `content.ts`, the cards and
  `[Image #N]` are all untouched, so history, deletion and renumbering are correct on day one
  because they are not being changed. `useComposer.capture(file)` is `onPaste` without the
  clipboard, so the file goes through the same raw-body invoke into `pasted-images` — which
  is also why a snapshot survives on disk and old sessions keep their pictures.
- **One bundle serves the Player and the renderer**, because `@remotion/bundler`'s `bundle()`
  only puts `@remotion/studio/renderEntry` into the same `entry` slot `preview/entry.tsx`
  occupies. Measured on `remocn-demo`: the hybrid costs ~20 KB over Player-only, against a
  second full compile (~7 s, 1.67 GB peak) for a second bundle. Three things make it work,
  and each cost a failed run:
  - The alias `@remotion/studio/renderEntry$` goes **before** the base config's aliases —
    Remotion pins `"@remotion/studio"` to a *file* and webpack matches by prefix, so the
    subpath otherwise resolves to `dist/index.js/renderEntry`. It resolves to
    `dist/esm/renderEntry.mjs`, exactly as `bundle()` does.
  - A `{ include: renderEntry, sideEffects: true }` module rule, so nothing can tree-shake a
    module imported purely for `window.getStaticCompositions`.
  - The page needs `#video-container`, `window.siteVersion = "11"` and
    `window.remotion_version`; `video-container` is read at module scope, so it has to be in
    the HTML before the bundle loads.
- **Two pages, one bundle, and each page is what decides which half runs.** The preview page
  carries `#__remotion-studio-container` and no `#video-container`; the render page, served
  at `/__remocn/render/index.html`, carries the opposite. Our entry already returns early
  when `getPreviewDomElement()` is null, so the Player simply never mounts for a render — no
  new flag was needed. The render page's siblings resolve from the same prefix, so
  `bundle.js` and its sourcemap load next to it.
- **The preview page sets `remotion_puppeteerTimeout` on purpose.** It is the only signal
  `renderEntry` has for "headless", and in its absence the index branch mounts a read-only
  **Studio** into `#video-container` and flips `remotion_isStudio`. Setting it to 30000 — the
  value `delayRender` already defaults to — makes that branch return early and changes nothing
  else, since `isRendering` additionally requires `NODE_ENV` to be production. Verified in a
  real headless Chrome against `remocn-demo`: `remotion_isStudio` false, `#video-container`
  absent, the Player mounted with a 1280×720 canvas.
- **The render page declares `NODE_ENV=production`, and that is load-bearing.** The first
  working end-to-end render came out **blank white**: the preview compiles with
  `environment: "development"`, so `getRemotionEnvironment().isRendering` was false and
  Remotion rendered nothing into the portal. The page sets
  `window.process = {env:{NODE_ENV:"production"}}` before the bundle, and
  `remotion_envVariables` to `""` — with a truthy value `setup-environment` overwrites
  `NODE_ENV` with the compiled one, and with a falsy one it assigns nothing and ours survives.
  With that, the still is **byte-identical** to `npx remotion still` on the same frame.
- **Only frames may reach the host's stdout, and third parties do not know that.** Remotion
  forwards browser console output to stdout during a render, which put `[Tab 0, …]` lines into
  the frame channel. The host swaps `process.stdout.write` and the stdout `console` methods
  onto stderr at startup, keeping the real writer for `write()`. Patching `console` as well as
  the stream is not belt and braces: under bun `console.log` bypasses `process.stdout.write`.
- **The host is asked over its own stdin**, in the frames it already answers in — no second
  transport for one method. `preview.still` carries `{ projectId, composition, frame }` and
  answers with a path; the supervisor keeps a registry of running hosts keyed by project and
  a pending map keyed by request id, so a still for a project with no preview fails with a
  sentence rather than hanging. Stopping the preview fails everything still pending.
- **Cropping and downscaling happen in the webview, through `<canvas>`.** The host renders a
  full frame to a temp file, the webview reads it over the asset protocol, crops, downscales
  to ≈1568 px on the long edge and hands the bytes to the invoke that already stores pasted
  images. No image library reaches the sidecar or Rust. Cropping *before* downscaling is what
  keeps detail in a small region.
  - **The still is loaded `crossOrigin="anonymous"`, and it has to be.** The asset protocol is
    a different origin from the window, so a plain `<img>` load taints the canvas and
    `toBlob()` throws `SecurityError` — WKWebView words it *"The operation is insecure."*, with
    nothing in it to say which operation. Tauri answers every asset request with
    `Access-Control-Allow-Origin: <window_origin>` (`protocol/asset.rs`), so asking for CORS is
    all it takes. Displaying an attachment never needed this, which is why the cards worked
    long before the first snapshot did.
- **The rectangle is normalised to the composition in the page**, which is why a box drawn on
  a small preview crops the same region on a large render — the app only ever multiplies by
  the resolution `selectComposition` reported. That is a different transform from Inspect's,
  which normalises to the page viewport to draw markers; both are pure and tested.
  `.__remotion-player`'s rect *is* the video box (the Player scales that div by transform), so
  the contain-fit in `videoBox` is a no-op there and insurance if that ever changes.
- **A tiny drag is a click**, so a shaky hand cannot hand you a four-pixel picture, and the
  marquee is drawn inside the preview document for the same reason Inspect's box is.
- **Each capture sweeps the stills folder first** and writes a uniquely named file, which is
  safe because the composer refuses a second capture while one is in flight — and that refusal
  is also what story "a second of work must not read as a dead button" is made of.
- **`ensureBrowser` runs before every render with its progress surfaced.** It is the one place
  this feature touches the network. The render also carries a `delayRender` timeout and the
  whole capture an outer one, so a scene that never resolves fails with a sentence instead of
  hanging the app.
- **The render options come from `remotion.config.ts` too**, read the way the CLI reads them:
  `renderOptionsOf` loads the config and then asks `@remotion/renderer`'s own option objects
  for their values, so `Config.setChromiumOpenGlRenderer`, `setDelayRenderTimeoutInMilliseconds`,
  the chrome mode and the rest apply to a snapshot exactly as they apply to `npx remotion
  still`. That is the whole point of rendering through the project's renderer, and it is why
  there is **no invented default**: `--gl=angle` changes the pixels of a render that uses no
  WebGL at all (verified: different hash, visually identical antialiasing), so defaulting it
  would move every project's snapshot away from what its own export produces.
  - **A WebGL scene is the case this decides.** Remotion's default GL backend is `null` — no
    `--use-gl` flag — so the render browser has no GL context, a shader never compiles, and a
    component that only calls `continueRender()` after a successful draw hangs until the
    timeout. `remocn-neon`'s aurora fails identically under the stock `npx remotion still`,
    which is the tell that this is the project's setting to make and not ours to guess. The
    failure says so: a message mentioning `delayRender()` gets the reason and the config line
    appended to it.
- **A capture costs one page load, and it used to cost two.** Measured on `remocn-demo`:
  `openBrowser` 195 ms, `newPage` 187 ms, **`goto` 3319 ms** — the navigation *is* the cost, and
  it is the project's doing, not Remotion's: that one page pulls **19.9 MB over 71 requests, 64
  of them fonts**, because `@remotion/google-fonts` fetches at runtime and holds a
  `delayRender` until it is done. `selectComposition` and `renderStill` are ~2.9 s each for
  exactly that reason — one page load apiece.
  - **Reusing the browser buys nothing** (5799 ms → 5900 ms across a shared instance, measured):
    Remotion opens a fresh page per call and the cache does not carry, so there is no pool here
    and no state to manage.
  - **What does buy something is not measuring twice.** The `VideoConfig` from
    `selectComposition` is cached per composition in the host and passed straight to
    `renderStill`, so a capture navigates once: **8.4 s → ~3.6 s**. The cache is dropped in the
    same callback that notifies the page of a rebuild, so a recompile can never be captured
    against a stale composition.
  - **And doing it before the click.** Arming Snapshot fires `preview.warm`, which measures the
    composition while the user is still aiming — 4.4 s that used to sit inside the first click.
    Commands are handled sequentially on the host's stdin, so a click that lands mid-warm waits
    for it rather than starting a second navigation.
  - **A capture navigates zero times, because the page stays open.** `renderStill` is a
    sequence — size the page, `setPropsAndEnv` (which navigates), `remotion_setBundleMode`,
    `seekToFrame`, `takeFrame` — and only the navigation is slow. `sidecar/preview/session.ts`
    holds the page open past the first four steps, so a capture is just the last two:
    **83–122 ms**, byte-identical to `npx remotion still` on the same frame. That is the whole
    point of Snapshot being a *look at this* gesture: it has to answer at the speed of a click.
  - **The price is naming six of Remotion's internal modules** — `set-props-and-env`,
    `seek-to-frame`, `take-frame`, `puppeteer-evaluate`, `prepare-server` and `openBrowser` —
    reached the way `dist/options/*` and `@remotion/cli/dist/entry-point.js` already are.
    `warmInternalsOf` returns `null` if any export moves, and the host then falls back to
    `renderStill` per capture: slower, never wrong. An upgrade can cost the speed but not the
    feature.
  - **The warm session starts its own offthread-video proxy, and the placeholder it replaced
    made every video unrenderable** (REM-312). `OffthreadVideo` builds each frame request from
    `window.remotion_proxyPort`, which `setPropsAndEnv` writes into the page — so the `0` this
    passed produced `http://localhost:0/proxy?…`, which Chrome refuses outright as
    `ERR_UNSAFE_PORT`. The `delayRender()` the video holds then never cleared and the capture
    died on Remotion's own guess: *"could be caused by Chrome rejecting the request because the
    disk space is low"*. Nothing about disk space was involved. `renderStill` never had the bug
    because `makeOrReuseServer` prepares a proxy per capture and hands it the real port; the
    warm session now calls the same `prepareServer` with the same arguments, before the browser
    — the port has to be in the page's environment from the first navigation — and closes it
    with the session, or with the failure if the page never opened. It cost `design_check` on
    every video that uses footage, which is the gate the conventions require before finishing a
    scene. Verified end to end against `remocn-studio-teaser`: a still on a frame inside the
    `OffthreadVideo` scene now renders the footage.
  - **A page with no source map throws on every line it logs.** `newPage` takes the getter as
    `context`, and the `null` passed there before — there was no server to take one from —
    made Remotion's own log handler fail with `this.sourceMapGetter is not a function`, 916
    times in this machine's log since July. That is how an `ERR_UNSAFE_PORT` came to be buried.
    `prepareServer` returns `sourceMap`, so it is passed; measured, the same run goes from 13
    of those TypeErrors to none.
  - **The session is keyed by composition and dropped on rebuild**, in the same callback that
    forgets the measurement — a page holding the old bundle would capture code that no longer
    exists. The webview already disarms on rebuild, so re-arming re-warms.
  - **Two orderings are load-bearing and cost three iterations to find.** The viewport is set
    *before* navigating, as `renderStill` does. And `remotion_calculateComposition` cannot
    replace `selectComposition` on the warm page without `waitForReady` between the evaluation
    `setBundleMode` and the call — without it the page reports *"Available compositions:"* and
    nothing else, because `setBundleMode` re-renders asynchronously. Measuring still costs its
    own navigation; it is cached, so only the first arm pays.
  - **Do not trust a stored hash as a fidelity baseline.** A PNG rendered hours earlier
    disagreed with a fresh one, and the warm session was blamed for it — but the stock CLI
    produced the *new* hash twice in a row. Whatever the project's runtime font loading resolves
    to is machine state, not a property of the renderer. Compare against a control rendered in
    the same session, or the comparison measures the clock.
  - **The floor for the warm-up is the project's.** One navigation is ~3.3 s, and a project that
    loads six Google font families with every weight pays most of it. Remotion says so in its
    own log — *"Consider loading fewer weights and subsets by passing options to loadFont()"* —
    and that is a change in the project, not here.
- **This was the first slice of Export**, which needs the same three things: the renderer
  resolved from the project, the browser provisioned, and progress reported. See *Exporting*.
