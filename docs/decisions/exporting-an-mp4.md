# Exporting an mp4

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`export/mp4-export`](../../openspec/specs/export/mp4-export/spec.md), [`export/render-settings-and-browser`](../../openspec/specs/export/render-settings-and-browser/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


Export opens a dialog — a preset to start from, three settings, and the file it will write —
and Export renders. The destination is **in** the dialog rather than behind a save panel of
its own. The render is the **project's own** `@remotion/renderer`, with progress,
cancellation and a reveal in Finder (#227, REM-5).
A queue, a frame range, a custom preset editor, separate audio knobs, alpha/ProRes 4444,
PNG sequences, H.265 and cloud rendering stay out of scope.

- **There is no second bundle, and that is the feature.** #227 says "bundle the project, render
  the composition" — but the preview host has *already* compiled that project and is serving the
  render page it compiled, so the export renders from a copy of that bundle. A second `bundle()`
  would cost another ~7 s and 1.67 GB peak for a byte-identical result, and it could differ from
  what is on screen — which is exactly what "content matches the preview" forbids.
- **A job renders from bytes nobody can change while it runs.** `sidecar/preview/job.ts` clones
  the compiled bundle *and* the project's `public/` when the job starts, serves the job at
  `/__remocn/job/<id>/` with a static base of its own, and removes the copy when it ends. On APFS
  that clone is `clonefile` and costs nothing: **200 MB across 8 files in 36 ms**, and the copy is
  a real one — the source truncated to 7 bytes left the clone at 25 MB. So an agent saving a file
  mid-render rebuilds what the pane is watching and never what the encoder is still asking for.
  What pinning does *not* cover is a scene fetching a remote URL, which is the issue's own "no
  bit-for-bit promise for non-deterministic code".
- **The job waits for a build it can render from.** `settledBuild` blocks on the compile the
  ProgressPlugin is reporting and fails with the compiler's own errors rather than pinning a
  half-written bundle. Stages are `preparing` → `rendering` → `finalizing`, reported as their own
  `ExportEvent`.
- **Preview and export resolve the same metadata.** `preview/entry.tsx` runs
  `Internals.resolveVideoConfig`, mounts the Player with the resolved width, height, fps, duration
  and props, and puts those numbers on the `composition` message; the export's `selectComposition`
  runs the same function in Chrome. So the size the dialog promises is a forecast from the same
  place, and a composition that computes its metadata is no longer unplayable in the pane. A
  Remotion too old to expose the resolver falls back to the static metadata.
- **Unsent element edits block the export rather than being rendered around.** A composer chip
  carrying codemod writes or tuning changes is a value that is live in the preview and not in the
  code; exporting now would render the file as it stands. The reason is on the button.
- **The renderer is resolved, then checked.** `renderMedia` and `makeCancelSignal` come off the
  same project module the stills already use; `exporterOf` refuses a Remotion too old to export
  with rather than throwing `undefined is not a function` mid-render. `agreedVersionIn` then reads
  `remotion`, `@remotion/renderer` and `@remotion/bundler` out of the project's `node_modules` and
  refuses when they disagree, naming **every** package that drifted.
- **The render writes a dotfile and is renamed at the end.** A cancel or a failure must not leave
  a half-written file that looks finished, and must not destroy the export from ten minutes ago;
  rendering beside the target and renaming on success gets both, since the rename is atomic and
  the cleanup only ever removes the partial. The removal is an `acquireRelease` acquired *before*
  the render, so it releases *after* it — finalizers run in reverse.
- **Cancelling waits for Remotion to stop before deleting anything.** `Effect.callback`'s cleanup
  runs on interruption and is awaited, so it calls Remotion's `cancel()` and then awaits the
  `renderMedia` promise settling. Without that wait the partial would be removed while ffmpeg was
  still writing it, and the write would recreate it. Ten seconds is the grace. `selectComposition`
  takes no cancel signal, so a cancel during the measuring stage ends the job from the person's
  side while that one call finishes in the background.
- **The export is forked, because the host's stdin loop is sequential.** `Stream.runForEach` over
  stdin serves one command at a time, so a `cancel` frame arriving during a three-minute render
  would not be *read* until the render finished. The export goes into a `FiberMap` keyed by request
  id: `FiberMap.remove` is the interrupt, `FiberMap.size` is the one-at-a-time gate, and keying by
  id means a late cancel for a finished export cannot kill the next one.
- **Progress is folded in the host and worded in the webview.** `renderMedia` reports
  `{renderedFrames, encodedFrames, progress, stitchStage}` and the host turns it into one
  `progress` event; `exportStatus` in `lib/studio/export.ts` decides whether that reads
  *Rendering — 64/300 frames*, *Encoding*, or *Combining the audio and the video*. Numbers cross
  the wire, sentences do not. `stitchStage` is normalised to the two values the schema knows — an
  unknown future stage would otherwise fail the stream decode and drop the chunk.
- **There is no outer wall-clock timeout**, unlike a snapshot's. A long render is the normal case;
  a frame that never resolves is already bounded by the project's own `delayRender` timeout.
- **A rebuild does not cancel a running export.** The job is rendering from its own copy, so a
  file changed mid-render cannot reach it — and killing a three-minute render because a file
  changed would be worse than the risk.
- **The export state carries the project it belongs to.** Switching projects hides that result
  without a reset effect, and switching *back* shows a render that is still going.

## The dialog

`shared/export.ts` is the whole model, and it is pure — the same file decides what the dialog
shows and what the sidecar renders.

- **Output size mirrors Remotion exactly.** H.264, H.265 and AV1 shrink each side until
  `round(side × scale)` is even and the other codecs do not, so `outputSize` does the same. A 9:16
  composition at the 1080 preset exports 1080×1920, and an odd source is trimmed with the trim
  named in the dialog rather than discovered in the file.
- **Resolution is the short side**, so `scale = target / min(width, height)` and the aspect ratio
  is never touched. Upscale is allowed with a warning about raster assets; past 16× the renderer
  refuses and so does the dialog, before the save dialog opens.
- **Quality is per codec, because a CRF is.** H.264 32/18/12 and VP9 40/28/20 around Remotion's own
  defaults of 18 and 28; ProRes takes proxy/standard/hq instead; a GIF has no quality field at all
  and says it carries no audio. *Project default* passes nothing of ours, which is what lets the
  project's own `Config.setCrf()` through.
- **A preset fills format, resolution and quality and nothing else.** YouTube is 16:9, Shorts ·
  Reels · TikTok is 9:16, Instagram Feed is 1:1 or 4:5, and all three fill H.264 / 1080 short side
  / High. A shape that does not match warns and changes nothing — the export keeps the video's own
  ratio. Changing a field falls to Custom, unless the change was a no-op.
- **The destination is a field, not a step.** A save panel answered "where" and "shall I start"
  in one gesture, which is why the dialog had nothing to say about the file it was about to
  write. Now a name field and a folder button sit in the dialog and Export renders: the person
  reads the whole decision before making it. The folder button is the project wizard's own
  Location idiom — an outline button with a folder icon and a middle-truncated path — so it
  reads as the same kind of control it is elsewhere.
- **The name follows the settings until somebody types.** Left alone it is
  `<Composition>-<preset>.<ext>`, so picking Shorts renames the file with it; typed once, the
  stem is theirs and only the ending keeps moving with the format. `typedName` turns a `/` or a
  `\` into a hyphen, because a separator would send the file somewhere the dialog is not
  showing.
- **The folder reads as the person thinks of it**: `out` by default, a relative path while it is
  inside the project, `~/Desktop` outside it, and an absolute path when it is on another volume.
- **There is no overwrite prompt, and that is the trade the field buys.** The panel used to
  raise macOS's own; now the exact file is on screen instead, said plainly by the dialog. Nothing
  is lost to a *failed* export either way — the render writes a dotfile and renames on success —
  so only a finished export replaces a finished export.
- **Settings are remembered per project**, under `export:<projectId>` in `settings.json`, holding
  the four fields and the folder. The absolute folder is a device preference, not a project asset.
- **The structure is what makes four pickers readable.** They used to be four peer stacks of
  pills with nothing to say which mattered. The preset is its own group — a shortcut, with a line
  saying so — and Format, Resolution and Quality share a label column beneath it, so they read as
  one block of settings rather than three more groups. The destination is a third shape entirely,
  and a summary surface under it says the one thing no control says: the real output size, the
  container and the length.

## The browser, and what it can draw

One policy for every renderer-backed operation — export, the stills behind Snapshot, the hover
clip, `design_check`, the source capture — resolved once in `toolsFor` and cached per host.

- **Remotion 4's default `gl` is `null`, and that is what broke WebGL exports.** Reproduced on a
  minimal WebGL2 scene: with no backend `canvas.getContext("webgl2")` returns null, the scene's
  `delayRender()` never clears, and the render dies with Remotion's stock advice about disk space.
  `glPolicy` chooses `angle` on macOS and Windows and `swangle` elsewhere when the project has
  said nothing.
- **An explicit project setting is never substituted.** `Config.setChromiumOpenGlRenderer()` is
  carried through with its source recorded, and a failure names the project rather than offering
  to change something the project chose.
- **The choice is measured in the browser that will render.** `probeGl` opens a browser with
  exactly those `chromiumOptions` and asks a page for a WebGL2 context. A `none` on a backend the
  *studio* chose falls back once to `swangle` and says so as an export notice; a `none` on a
  backend the *project* chose is reported and left alone. One probe per host per option signature.
- **`delayRender()` is no longer a synonym for WebGL.** `sidecar/preview/failure.ts` classifies —
  `gl-unavailable`, `gl-lost`, `crash`, `stuck`, `asset`, `encoder`, `javascript`, `unknown` — and
  the hint for a stuck render depends on what the probe measured: the GL sentence appears when the
  browser really could not make a context, and otherwise the message names fonts, network, media
  and shaders. The raw failure always stays above the reading.

## Reading the project's own render settings

`sidecar/preview/config.ts` replaced a seven-entry hand-written table with the project's own
option registry, `allOptions` out of `@remotion/renderer/dist/options/index.js`.

- **What may be forwarded is read off the installed `renderMedia`.** `acceptedBy` parses the
  destructured parameter names from the function's own source, so a Remotion that gains or loses
  an option needs no change here. Three anchors (`serveUrl`, `composition`, `codec`) prove the
  parse; failing them falls back to the set the studio knows **and says so**. `renderStill`
  destructures in its body rather than its parameters, which is why the parser reads both shapes.
- **`ssrName` is trusted except where it is measurably wrong.** `enable-multiprocess-on-linux`
  declares `chromiumOptions.enableMultiprocessOnLinux` and `open-browser.js` reads
  `chromiumOptions.enableMultiProcessOnLinux`; a spelling table corrects it. The seven browser
  options whose `ssrName` is bare — `gl`, `headless`, `darkMode`, `userAgent`,
  `disableWebSecurity`, `ignoreCertificateErrors`, `enableMultiProcessOnLinux` — are routed into
  `chromiumOptions`, which is what `renderMedia` actually takes. `still-image-format` and
  `video-image-format` share the `ssrName` `imageFormat` and are kept apart by scope.
- **An option the installed Remotion cannot answer for is a reported problem, not a null.** The
  three no config file can set — `codec`, `on-browser-download`, `webhook-custom-data` — are named
  and skipped, so a healthy project reports nothing. Measured against two real projects
  (4.0.521 and 4.0.513): zero problems, and a configured `gl: "angle"` and
  `videoImageFormat: "jpeg"` both read.
- **Incompatible values never travel silently.** A `crf` is dropped from ProRes and GIF (Remotion
  throws *the codec does not support --crf*), a `proResProfile` from anything but ProRes (Remotion
  throws), an `audioCodec` the container cannot hold, a `videoBitrate` beside a chosen quality, and
  an `encodingMaxRate` with no buffer size beside it. Each drop reaches the person as an export
  notice naming the option and the reason.
- **Staleness is answered with a process, not a cache-bust.** `--render-config` re-execs the
  sidecar bundle, resolves in a fresh process and prints JSON, so the config *and everything it
  imports* are read afresh — measured at **514 ms** from source. An export always reads fresh;
  stills and design checks read through a cache keyed on the config file's mtime and size.
- **A configured `ffmpegOverride` is reported, not applied.** It is a function, so it cannot cross
  the worker boundary; detecting it is a reference comparison against the value a
  `resetConfigOptions()` leaves behind, and the export says plainly that it does not apply it.

## Renderer smoke tests

`sidecar/preview/render-smoke.test.ts` drives the **real** renderer through the real supervisor
and the real preview host, against a fixture project under `test/fixtures/render-smoke/` with its
own Remotion 4.0.520 install. It skips itself when the fixture is not installed, so `bun run test`
stays fast; `bun run smoke:render` installs it, generates its media and runs it.

- **The WebGL case is red without the fix by construction.** One test renders the WebGL2
  composition with `gl: null` — the state Remotion 4 defaults to — and requires it to fail; the
  next renders the same composition through the studio's own path and requires the decoded frames
  to move.
- **The fixture makes its own media.** Remotion renders the clip and the WAV is synthesised in JS,
  because Remotion's bundled ffmpeg is built down to what Remotion needs: no `testsrc` filter and
  no rawvideo demuxer or muxer. Frames come back out of that same ffmpeg through
  `-f image2pipe -c:v rawvideo`, which it does have, and are averaged per frame — a file existing
  is not evidence.
- **The supervisor re-execs `process.argv[1]`**, which under `bun test` is the runner rather than
  the sidecar, so the suite sets it. Everything else about the spawn is the real one.
- **Two faults came out of running it that no unit test would have found.** The renderer refuses
  an output filename whose ending it does not know for the codec — *"the output filename must end
  in one of the following: mp4, mkv, mov"* — and a save panel lets a person type one, so
  `withExtension` appends the format's own ending rather than replacing what they typed, and the
  export says it did. And back-to-back exports refused each other: the reply frame went out inside
  the job's scope, so the promise settled while the pinned copy was still being removed and the
  fiber was still alive, and the next export met "an export is already running". The answer is
  written after the scope closes now.
