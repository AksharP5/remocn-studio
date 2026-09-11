# The moodboard

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`library/moodboard`](../../openspec/specs/library/moodboard/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


Before a video is built, the agent can assemble a moodboard: 5–8 stock photo
references, a palette extracted from them, a Google Fonts pairing and tone words
(REM-266). The AI is curator and typesetter, not painter — the visual content is
found, and only primitives are drawn.

- **The spec is neutral on purpose.** `shared/moodboard.ts` holds `MoodboardSpec`
  next to `library.ts`: images with per-block ids, role, grid spans and their own
  `AssetSource` (the manifest's `source` is one-per-asset, so per-image
  attribution has to live in the spec), palette swatches, typography pairs,
  keywords, and the project the board belongs to. The generation does not know
  which canvas renders it — the PNG is the default, and a Paper or Figma adapter
  (REM-265) is a later translation of the *same* spec.
- **The PNG render is a page, not a canvas.** `moodboardHtml` in
  `sidecar/library/moodboard.ts` builds a deterministic HTML+CSS collage authored
  to exactly 1440×900 — the viewport `captureSourcePage` already opens — so the
  render rides the preview host's existing `source` command with **zero protocol
  change**, loading the page over `file://` (the http(s)-only guard is the agent
  layer's, not the capture's). Images are local staging files; the only network
  on render is the Google Fonts stylesheet, and `document.fonts.ready` is already
  awaited. Consequence accepted in the issue: no running preview, no board.
- **A board is an ordinary asset.** `assets/<slug>/` with `spec.json` (the marker
  file, in `files`), `images/*` and the rendered `preview.png` as the card still;
  `type` stays `img`. No manifest field was added, so previews, the undo window
  and insertion all work unchanged. `board.html` is *not* stored — it is derived
  from the spec on every render.
- **Three tools on the existing `remocn-library` server** — `specs.test.ts` pins
  `TOOL_SERVERS` to exactly three servers and the permission auto-allow derives
  from that list, so a fourth server was never an option. `search_stock` speaks
  the REM-258 Pexels client (key and network stay in the sidecar; the answer
  carries `download` and `pageUrl` for the agent to pass back). `save_moodboard`
  downloads the picks, writes the spec, renders and saves; it **replaces** the
  project's existing board, which is the iteration path — "replace the third
  photo" is the same call with one block changed. `get_moodboard` is the
  idempotence gate: an existing board answers as ready spec + PNG path, and the
  brand stage's discover order calls it first, so the expensive search-and-curate
  pass is never repeated unless the person asks to start over in words.
- **`freeSlug` never overwrites** — it silently mints `slug-2` — so "already
  exists" is an explicit `findMoodboard` probe (scan for `spec.json`, match
  `spec.project`), and replacement is a `removeAsset` before the save.
- **The render callback is injected** (`MoodboardRender`), so
  `sidecar/library/moodboard.test.ts` exercises staging, replacement and the
  store against a temp library with a fake fetcher and a renderer that writes
  bytes — the one thing no seam can test is the real Chrome `file://` capture,
  which is verified in the running app.
