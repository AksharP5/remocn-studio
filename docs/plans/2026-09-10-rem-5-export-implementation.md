# Export: what was built for REM-5

Date: 2026-09-10. Issue: https://linear.app/remocn/issue/REM-5
Audit it answers: `docs/plans/2026-09-09-export-readiness-analysis.md`

The audit's finding was that a dialog alone would have decorated a render that
did not yet keep its promises: the export could disagree with the preview about
the composition, could not read the project's own render settings, chose no GL
backend, and rendered from a bundle the agent was still writing to. Those four
are the work; the dialog sits on top of them.

## 1. One browser policy, and a measurement behind it

`sidecar/preview/browser.ts` is the single place a render browser is decided,
and every renderer-backed operation now goes through it — export, the stills
behind Snapshot, the hover clip, `design_check` and the source capture all take
their options from `toolsFor` in `host.ts`.

- **An explicit `Config.setChromiumOpenGlRenderer()` is never substituted.** It
  is carried through with its source recorded, and a failure names the project
  rather than offering to change something the project chose.
- **With nothing configured the studio picks `angle` on macOS and Windows** and
  `swangle` elsewhere. Remotion 4's own default is `null`, which is what the
  audit reproduced as `canvas.getContext("webgl2") returned null`.
- **The choice is then measured in the browser that will do the rendering.**
  `probeGl` opens a browser with exactly those `chromiumOptions`, opens a page
  and asks it for a WebGL2 context. `none` on a backend the *studio* chose falls
  back once to `swangle` and says so as an export notice; `none` on a backend
  the *project* chose is reported, never overridden. The reading is cached per
  host per option signature, so it is paid once and not per capture.

## 2. Failure is classified, not guessed at

`sidecar/preview/failure.ts` replaces the blanket rule that treated any
`delayRender()` as a WebGL problem. `diagnoseRender` answers one of
`gl-unavailable`, `gl-lost`, `crash`, `stuck`, `asset`, `encoder`, `javascript`
or `unknown`, and the hint for a stuck render depends on what the probe actually
measured: the GL sentence appears when the browser really could not make a
context, and otherwise the message names fonts, network, media and shaders and
points at `setDelayRenderTimeoutInMilliseconds`. The raw failure is always kept
above the reading.

## 3. The project's render settings, read for real

`sidecar/preview/config.ts` replaces a seven-entry hand-written table with the
project's own option registry — `allOptions` out of
`@remotion/renderer/dist/options/index.js` — and forwards, per option, the value
and the source Remotion itself reports.

- **What may be forwarded is read from the installed `renderMedia`.**
  `acceptedBy` parses the destructured parameter names off the function's own
  source, so a Remotion that gains or loses an option needs no change here. Three
  anchors (`serveUrl`, `composition`, `codec`) prove the parse; failing them
  falls back to the set the studio knows *and says so* rather than silently
  applying nothing. `renderStill` destructures in its body rather than its
  parameters, which is why the parser reads both shapes.
- **`ssrName` is trusted except where it is measurably wrong.**
  `enable-multiprocess-on-linux` declares
  `chromiumOptions.enableMultiprocessOnLinux` while `open-browser.js` reads
  `chromiumOptions.enableMultiProcessOnLinux`; a spelling table corrects it. The
  seven browser options whose `ssrName` is bare (`gl`, `headless`, `darkMode`,
  `userAgent`, …) are routed into `chromiumOptions`, which is what `renderMedia`
  takes. `still-image-format` and `video-image-format` share the `ssrName`
  `imageFormat`, so they are kept apart by scope.
- **An option the installed Remotion cannot answer for is a reported problem,
  not a null.** The three that no config file can set — `codec`,
  `on-browser-download`, `webhook-custom-data` — are named and skipped, so a
  healthy project reports nothing. Measured against two real projects
  (`remocn-studio-landing` on 4.0.521 and `remocn` on 4.0.513): zero problems,
  and the landing's `gl: "angle"` and `videoImageFormat: "jpeg"` both read.
- **A value that cannot cross a process boundary is refused rather than
  mangled**, which is how a configured `ffmpegOverride` is detected: it is
  reported as a notice on the export, because a studio export does not apply it.
- **Incompatible values never travel silently.** `compatibleWith` drops a `crf`
  from ProRes and GIF (Remotion throws: *the codec does not support --crf*), a
  `proResProfile` from anything but ProRes (Remotion throws), an `audioCodec`
  the container cannot hold, a `videoBitrate` beside a chosen quality, and an
  `encodingMaxRate` with no buffer size. Each drop is an export notice naming
  the option and the reason.
- **Staleness is answered with a process, not a cache-bust.**
  `sidecar/preview/config-host.ts` re-execs the sidecar bundle as
  `--render-config`, which resolves in a fresh process and prints JSON — so the
  config *and everything it imports* are read afresh. Measured at **514 ms** from
  source. An export always reads fresh; stills and design checks read through a
  cache keyed on the config file's mtime and size.

## 4. The preview and the export agree on the composition

`preview/entry.tsx` resolves `calculateMetadata` through
`Internals.resolveVideoConfig` and mounts the Player with the **resolved**
width, height, fps, duration and props. The `composition` message carries those
numbers, so the dialog's output size is a forecast from the same function the
export's `selectComposition` runs. A Remotion too old to expose the resolver
falls back to the static metadata, and a composition that computes its size and
fails is reported as `trouble` rather than rendering nothing with no reason.

An export blocked by unsent element edits refuses with a sentence rather than
rendering the file as it stands: `pendingEdits` counts composer chips carrying
codemod writes or tuning changes, and `useExport` names them as the reason.

## 5. A job renders from bytes nobody can change

`sidecar/preview/job.ts` takes a copy of the compiled bundle **and** of the
project's `public/` when a job starts, serves the job from that copy under
`/__remocn/job/<id>/`, and deletes it when the job ends. On APFS this is
`clonefile`: **200 MB across 8 files copied in 36 ms**, and the clone is proven
independent — the source truncated to 7 bytes left the copy at 25 MB.

An export therefore waits for the build to settle, pins, measures against the
pinned bundle, and renders against it: an agent saving a file mid-render
rebuilds what the pane is watching and never what the encoder is still asking
for. The job also reports its stages — `preparing`, `rendering`, `finalizing` —
and still renders to a dotfile beside the target, renamed only on success.

## 6. The dialog

`shared/export.ts` is the whole model and is pure: four formats, four qualities,
four resolutions, three presets, the output size, the filename and the review.

- **Output size mirrors Remotion exactly**, including that H.264, H.265 and AV1
  shrink each side until `round(side × scale)` is even, and the other codecs do
  not. A 9:16 composition at the 1080 preset exports 1080×1920.
- **Quality is per codec**: H.264 CRF 32/18/12, VP9 40/28/20 around Remotion's
  own defaults of 18 and 28, ProRes proxy/standard/hq, and no quality field at
  all for a GIF, which also says it carries no audio. *Project default* passes
  nothing of ours and lets the project's own settings through.
- **A preset fills format, resolution and quality and nothing else.** A shape
  that does not match warns and changes nothing: the export keeps the video's
  own aspect ratio. Changing any field falls to Custom, unless the change was a
  no-op.
- **The destination is a field, not a step.** A native save panel answered
  "where" and "shall I start" in one gesture, so the dialog had nothing to say
  about the file it was about to write. A name field and a folder button live in
  the dialog now and Export renders. The name follows the preset and the format
  until somebody types, after which the stem is theirs and only the ending
  moves; `typedName` turns a separator into a hyphen so a file cannot land
  somewhere the dialog is not showing. The folder button is the project wizard's
  own Location idiom. Settings and folder are remembered per project id under
  `export:<projectId>`.
- **The trade that buys**: no native overwrite prompt. The exact file is on
  screen instead, and only a *finished* export replaces a finished export —
  the render writes a dotfile and renames on success.
- **The structure is what makes four pickers readable.** They were four peer
  stacks of pills with nothing to say which mattered. The preset is its own
  group; Format, Resolution and Quality share a label column beneath it and read
  as one block; the destination is a third shape; and a summary surface says the
  one thing no control says — the real output size, the container and the
  length.

## 7. Tests

Unit and hook tests cover the pure halves: the export model, the failure
classifier, the config resolver and its compatibility rules, the browser policy
and its fallback, the job pinning, the preview server's job routes, the config
cache, the dialog and the hook.

`sidecar/preview/render-smoke.test.ts` is the part the audit demanded and the
repo did not have: it drives the **real** renderer through the real supervisor
and the real preview host, against a fixture project under
`test/fixtures/render-smoke/` with its own Remotion 4.0.520 install. It skips
itself when the fixture is not installed, so `bun run test` stays fast;
`bun run smoke:render` installs it, generates its media and runs it.

The fixture's own footage and tone are produced by `bun run smoke:assets`:
Remotion renders the clip, and the WAV is synthesised in JS, because Remotion's
bundled ffmpeg is built down to what Remotion needs and has neither a `testsrc`
filter nor a rawvideo demuxer. Frames are decoded back out through that same
ffmpeg with `-f image2pipe -c:v rawvideo`, which it does have.

**The WebGL case is red without the fix by construction**: one test renders the
WebGL2 composition with `gl: null` — the state Remotion 4 defaults to — and
requires it to fail *with the fixture's own `getContext("webgl2") returned
null`*, so it pins the cause rather than the symptom; the next renders the same
composition through the studio's own path and requires the decoded frames to
move. **9 tests, 9 passing, 17 s** on this machine once the fixture and Chrome
are in place.

Two product faults came out of running it, neither of which any unit test would
have found:

- **The renderer refuses an output filename whose ending it does not know for
  the codec** — *"the output filename must end in one of the following: mp4,
  mkv, mov"* — and a macOS save panel will happily let a person type one.
  `withExtension` appends the format's own ending rather than replacing what
  they typed, and the export says it did.
- **Back-to-back exports refused each other.** The reply frame used to go out
  inside the job's scope, so the person's promise settled while the pinned copy
  was still being removed and the fiber was still alive — and the very next
  export met "an export is already running". The answer is now written after the
  scope closes.

## What is deliberately not done

- **The frame range, a queue, a custom preset editor, separate audio knobs,
  alpha/ProRes 4444, PNG sequences, H.265 and cloud rendering** stay out of
  scope, as the issue says.
- **`selectComposition` takes no cancel signal**, so cancelling during the
  measuring stage ends the job promptly from the person's side while that one
  call finishes in the background. Every later stage cancels for real.
- **A project's `ffmpegOverride` is reported, not applied.** Applying it would
  mean reading a function out of a module cache the config worker exists to
  avoid.
- **A custom web font is not in the smoke fixture.** The DOM composition renders
  text in a system stack; shipping a font file to test `@font-face` is its own
  decision.
- **Pinning covers the bundle and `public/`.** A scene that fetches a remote URL
  mid-render is still reading whatever that URL serves, which is the issue's own
  "no bit-for-bit promise for non-deterministic code".
