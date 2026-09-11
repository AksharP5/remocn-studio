# Footage the preview cannot afford

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`library/asset-library`](../../openspec/specs/library/asset-library/spec.md), [`preview/live-preview`](../../openspec/specs/preview/live-preview/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


A video asset taller than the composition previews from a **proxy** — a 1080p h264
re-encode — while the export and the snapshot keep the original. The reason is one
measurement, and it is not the one the symptom suggested.

- **The cost is the seek, not the decode.** Measured in WebKit on a 15s clip: playing
  3840×2160 presented 24.4 fps with a 33ms median gap between frames — the hardware
  decoder keeping up — against 28.1 fps and the same median at 1920×1080. But a
  **seek** cost **59ms** at 4K against **6ms** at 1080p, and the tail was 97ms against
  84ms. Remotion's preview seeks constantly: `use-media-playback.js` sets
  `seekThreshold` to `playing ? 0.15 : 0.01`, so while the Player is paused *every*
  frame step is a seek, and 59ms is nearly two frame budgets at 30fps. A clip mounting
  mid-transition pays it at the worst possible moment. So `PROXY_HEIGHT` is 1080
  because that is where a seek stops costing a frame, not because it is a round number
  — and a 1080p source is left alone rather than re-encoded for nothing.
- **The substitution is two static bases, and the render page never sees a proxy.**
  `pageOptions` takes the base as an argument now: `previewPage` gets `previewBase`,
  `renderPage` keeps `staticBase`. The server resolves the first proxy-first and the
  second never, so `staticFile("library/clip.mp4")` is untouched in the project's code,
  the preview streams 1080p, and an export — which loads the render page — carries the
  original. The proxy answers under the original's URL with **its own** size and ETag,
  so a clip whose proxy lands mid-session invalidates what the webview cached rather
  than being pinned to whichever it saw first; the media type stays the URL's.
- **Matching is by content, because the file the preview asks for is a copy.**
  Insertion copies a library asset into the project's `public/library/`, so a proxy
  keyed by path would only ever serve the one folder. `sidecar/preview/proxies.ts`
  hashes the served file — about 40ms on 15MB, paid once per file per host, on the
  range probe a webview opens a video with — and looks it up against an index built
  from the library manifests. One proxy therefore covers every project the asset
  reached, and footage nobody put in the library is simply never matched.
- **The index is re-read on a timer, not on a signal.** A conversion takes minutes and
  lands mid-session; a scan of a few dozen small manifests every few seconds is cheaper
  than a channel between the sidecar and the host that would have to be kept in step.
  The lookup is synchronous because it happens inside the request handler, where a
  fiber would reorder the response — the same rule the `Channel` decoders follow.
- **The converter is ours, not the project's.** `@remotion/webcodecs` is a dependency of
  the *app* — 1.4MB, one transitive dep, no peer on `remotion` — dynamically imported so
  it is its own chunk. That does not break "the pixels come from the project's Remotion":
  a proxy is never in the render path. `canEncode()` asks
  `VideoEncoder.isConfigSupported` at run time rather than trusting the Safari reading,
  and a webview without an encoder records the decision and keeps playing originals.
- **0.58× realtime is what makes this a backfill.** Even with hardware encoding, a
  two-minute clip is three and a half minutes of work, so `useBackfilledProxies` is
  modelled exactly on `useBackfilledThumbnails`: sequential, each slug marked as its own
  turn begins, failures remembered for the session. The asset is usable the moment it
  lands; until its proxy exists the preview streams the original, which is slower to
  seek and never broken. `proxied` on the manifest is what stops a file already at the
  target, or a webview with no encoder, being measured again on every listing.
- **The proxy lives inside the asset folder**, as `proxy.mp4` beside `preview.png`, so
  deleting an asset takes its proxy with it and the undo window needs no new code.
