## Context

See proposal.md, *Why*. The measurements behind the decisions below were taken on
2026-09-29 in a scratch Remotion 4.0.520 project against test-orcdev's clip
`1 (3).mp4` (1080×1920, H.264, time base 1/16000, 226 frames). Each render ran 220
frames at 30 fps. Every exported frame was matched to a source frame after
normalising brightness.

| Render | Right source frame | Pattern |
| --- | --- | --- |
| `OffthreadVideo`, original file | 144 / 220 | `0,1,1,3,4,4,6,7,7…` |
| `OffthreadVideo`, remuxed onto exact n/30 | reference | `0,1,2,3,4,5…` |
| `<Video>` (`@remotion/media`), original file | 212 / 220 | `0,1,2,3,4,5…` |
| `<Video>` (`@remotion/media`), remuxed file | identical to the row above, pixel for pixel | |

The 8 frames where `<Video>` differs from the reference are neighbours in a
capture that repeats a near-identical frame every sixth frame (25 fps padded to
30), where the matcher cannot tell them apart.

The same holds for the whole film. test-orcdev was switched to `<Video>` from
`@remotion/media` and pointed back at the original camera files, then rendered
in full (803 frames). The comparison reference is the earlier export, verified
free of judder, which played the remuxed copies through `OffthreadVideo`. Each
new frame was compared with the reference frame at its own index and at both
neighbours. 500 frames differ from their neighbours enough to tell them apart;
499 of those matched their own index. The one exception is frame 759, in the
closing scene. The other 301 frames cannot be told from a neighbour (the
capture's own repeats), so they prove nothing either way.

Where the two components differ:

- `OffthreadVideo` computes `time = frame / fps` (`remotion/dist/cjs/video/get-current-time.js`)
  and asks the compositor at
  `http://localhost:${remotion_proxyPort}/proxy?src=<absolute src>&time=<t>&…`.
  The compositor returns the last frame that started at or before `t`, with no
  tolerance.
- `@remotion/media`'s `getFrameFromTimestamp` accepts a sample when
  `round3(sample.timestamp) <= round3(t)` or `|sample.timestamp - t| <= 0.001`
  (`@remotion/media/dist/esm/index.mjs:4106`, 4.0.520).

The design check runs entirely in the preview host (`sidecar/preview/host.ts` for
sampled mode, `sidecar/preview/readiness.ts` for full and report modes). The host
already knows the project's `publicDir` and the `staticBase` the render page loads
files from (`sidecar/preview/server.ts`). The conventions are
`sidecar/claude/conventions.ts`, one text shared by all four adapters.

## Goals / Non-Goals

**Goals:**

- The agent writes footage with a component that tolerates millisecond-rounded
  clocks, before anything is rendered.
- When `OffthreadVideo` is still used, the check names the file, says how bad it is,
  and gives the fix. The agent does not have to rediscover the cause from exported
  frames.

**Non-Goals:**

- Measuring judder in the exported pixels. The file tells us exactly which slots
  will be wrong, deterministically and in milliseconds, while a pixel matcher is
  confused by padded captures (see the 8 frames above).
- Modelling `<Video>`'s own frame choice. It is the recommended component, and the
  check has no finding to make about it.

## Decisions

### 1. Recommend `<Video>` from `@remotion/media`, not a remux at import

The component swap is what fixes the cause: the original and the remuxed file
rendered pixel-identical through `<Video>`. A remux needs a muxer in the app, and
the app ships none. `@remotion/webcodecs` is used for proxies and re-encodes; it
does not stream-copy. A remux would also rewrite a file the person brought. It
remains the fallback the lesson describes for a Remotion without `@remotion/media`
(first published as 4.0.351).

### 2. The footage sentence is a convention, backed by a lesson

The vendored `remotion-best-practices` skill already says `<Video>`, and the agent
still wrote `OffthreadVideo`. So a skill page alone did not work. The sentence goes
in the conventions, which every turn carries whether or not the bundle loaded. The
supporting detail (symptom, how to recognise the file, correction,
counterexample) goes in `video-lessons/references/rendering.md`, in the format that
skill asks lessons to follow. The conventions carry one sentence and the lesson
carries the evidence.

### 3. Find footage in the rendered page, not in the source

In test-orcdev, `src` reaches `OffthreadVideo` as a prop through a scene config
(`Footage({ src })` → `staticFile(src)`). A static scan would have to follow data
flow, and it could not tell `OffthreadVideo` from `<Video>` when a video uses both.
In the render page, every mounted `OffthreadVideo` fetches its frame from a URL
with path `/proxy`, the port `window.remotion_proxyPort`, and the `src` and
`time` parameters.

The first plan read those URLs off the `<img>` elements, and it would have found
nothing. `OffthreadVideoForRendering` fetches the proxy URL with `fetch()` and
puts a `blob:` URL into the `<img>`, so the proxy address never reaches the DOM.
What does keep it is the page's Resource Timing buffer. A still rendered with
`@remotion/renderer` against a probe composition logged
`performance.getEntriesByType("resource")` holding
`http://localhost:3001/proxy?src=http%3A%2F%2Flocalhost%3A3001%2Fpublic%2Forig.mp4&time=0.06666666666666667&…`
for frame 2.

So a small page function, evaluated in the same audit right after the seek,
reads the resource entries for the proxy and then clears the buffer, so each
frame sees only its own requests. The proxy fetch uses `cache: "no-store"`, so
every seek produces an entry. The `(src, time)` pairs ride on
`FrameDesignAudit` as an optional `footage` field, and nothing new crosses a
process boundary.

The consequence is recorded in the spec: a sampled check only sees footage
mounted on an inspected frame. The full mode samples the whole video, so in
practice it sees every clip.

### 4. Read timestamps with our own ISO-BMFF reader

`sidecar/preview/footage.ts` reads only the boxes needed: top-level box headers
(32- and 64-bit sizes, since `moov` may follow `mdat`), then within `moov` the
first `trak` whose `hdlr` is `vide`, its `mdhd` timescale, `stts` for decode times,
`ctts` for composition offsets (version 0 unsigned, version 1 signed), and `elst`.
The edit list is supported for the common shapes: one media edit shifts every
timestamp by its `media_time`, and a leading empty edit delays by its duration in
the `mvhd` timescale. Any other edit list makes the file unmeasurable with that
reason. This mirrors what ffmpeg's mov demuxer hands the compositor.

Alternatives considered:

- **The project's ffprobe**, shipped inside `@remotion/compositor-*`. It is exact,
  but it is reached through `RenderInternals`, which changes between Remotion
  releases. It also costs a process spawn per file.
- **`@remotion/media-parser`**, which the app reaches only transitively through
  `@remotion/webcodecs`. It yields samples while streaming the whole file,
  including `mdat`. We need only the sample table, a few kilobytes of `moov`.

The reader works on a byte-range function, so tests feed it buffers. File access
is `Effect.acquireUseRelease` over a `node:fs` `FileHandle` with positioned reads,
which is how the rest of the sidecar touches files. It fails with a `FootageError`
tagged error that carries the reason sentence.

### 5. The slot model

For composition fps `f` and presentation times `p_i` in seconds, the grid is
`t_k = k / f` over the clip's span. A slot is **late** when some
`p_i ∈ (t_k, t_k + 0.001]`. Comparison uses integer ticks where `f` is an
integer (`p_ticks · f` against `k · timescale`, plus the tolerance in ticks), so
533⅓-tick frames never produce floating-point false positives. A fractional `f`
(29.97) falls back to doubles with a 1e-9 guard.

`trimBefore` moves the clip by whole frames, so the grid is unchanged. A playback
rate other than one moves the grid. It is detected from the observed `time`
values: if any is off `k/f` by more than 1e-6 of a frame, that file is unmeasured
("played at another speed").

On the test clip this model predicts 75 late slots out of 226 (every third). The
render showed 73 skips in 220 frames.

The finding: code `footage_late_frames`, audience `viewer`, category `footage`,
conclusion `measurement`, severity `warning`, selector = the file's path relative
to the project, frames = the inspected frames it appeared on, `from`/`to` = the
span of those frames. The `measurements` field holds `lateSlots`, `slots` and
`maxLatenessMs`. The confidence sentence says the model is `OffthreadVideo`'s
exact-time lookup as observed on Remotion 4.0.520.

A file that cannot be measured is `footage_unmeasured`, severity `info`, in sampled
mode, and the reason of a `skipped` rule status in full mode. The full-mode rule
is named `footage_timing` and is added to `RULES`. Both new codes join
`DesignFindingCode`.

### 6. Process ownership and the wire

Everything lives in the preview host process. The page collects the pairs, the
host reads the files, and the findings ride in the existing `design-done` frame
and readiness report. Both already carry findings whose `code` the sidecar passes
through. No `shared/ipc.ts` change, no `SIDECAR_PROTOCOL` / Rust `PROTOCOL` bump,
no history migration, no `settings.json` key. A file is read at most once per
check. Nothing is cached across checks, because the report revision already
hashes the assets.

### 7. Failure direction

A read or parse failure is an unmeasured file: a skipped rule with a sentence, or
an info finding. It never fails the design check, and it never produces "clean".
A failure of the in-page collection itself makes the rule `failed` in full mode,
with the reason, and the visual findings are kept. In sampled mode it is dropped
with a log line, like the tunability scan does.

### 8. The template declares the package

`templates/remotion/package.json` gains `"@remotion/media": "4.0.520"`. Today it
is reachable in a new project only because `@remotion/studio` depends on it, and a
hoisting change would break an import that the manifest never declared. The
Remotion upgrade in `projects/dependency-install` already upgrades every scoped
Remotion package the manifest declares, so it will keep this one in step.

## Risks / Trade-offs

- **The preview was built around `OffthreadVideo`.** `preview/media-release.ts`
  tears down detached `<video>` players because WebKit kept 1.3–1.6 GB per loop.
  `<Video>` in the Player decodes through WebCodecs into a canvas instead. So
  memory per loop, seek cost, and whether the 1080p proxy served under the
  original URL still applies are all unmeasured in WKWebView. → Task 1 checks this
  in the running app before the convention ships. If `<Video>` does not preview
  acceptably, the convention and template tasks stop. The design-check rule and
  the lesson still ship, with the lesson's correction switched to the remux.
  Checked by the person on 2026-09-29 in the running app, on test-orcdev switched
  to `<Video>` with the original camera files. (a) Playback and frame stepping
  showed no blank or ⚠️. (b) Seeking did not stall; the clips are 1080×1920, so
  no proxy was involved. (c) Memory did not climb per loop. (d) Snapshot and
  Export carried the footage. All four passed, and the convention ships.
- **The two components differ by about 2 grey levels** (mean absolute difference
  1.99 on 0–255, constant across frames). Task 1.1 settled the direction on frame
  30 of the test clip, which is tagged BT.709 limited range. Both stills were
  compared with ffmpeg's decode of that frame (`in_color_matrix=bt709`,
  `in_range=tv`, full-range RGB out); the numbers are signed mean / mean absolute
  difference per R/G/B channel:

  | Still | Signed mean R/G/B | Mean absolute R/G/B |
  | --- | --- | --- |
  | `OffthreadVideo` | −2.24 / −1.77 / −2.04 | 2.25 / 1.77 / 2.05 |
  | `<Video>` (`@remotion/media`) | −0.01 / −0.00 / +0.41 | 0.25 / 0.09 / 0.93 |

  `OffthreadVideo` is the one off: it renders about 2 levels darker than the
  source. `<Video>` matches the source. The switch therefore also corrects
  brightness rather than costing it. An earlier reading of the unsigned difference
  in this change had it the other way round.
- **The 1 ms tolerance is an implementation detail of `@remotion/media`,** verified
  on 4.0.520 only. → The lesson names the version. The design-check rule does not
  depend on it, since it only models `OffthreadVideo`.
- **Our reader and ffmpeg could disagree on an edit list we did not model.** → Such
  files are unmeasured rather than guessed. A test compares the reader against
  `ffprobe -show_entries packet=pts` on the test clip and on the render-smoke
  fixture's media.
- **A sampled check misses footage between key frames.** → This is stated in the
  spec. The full mode is the one the conventions require before finishing.
