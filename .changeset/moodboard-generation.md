---
"remocn-studio": minor
---

Generate a moodboard before building the video: photo references, a palette, a
type pairing and tone words, curated by the agent and rendered to a real PNG.

The spec is a neutral JSON structure (`shared/moodboard.ts`) — the generation
does not know which canvas the board will end up on, which is what keeps a
Paper or Figma adapter (REM-265) a pure translation later. The default render
needs no external MCP at all: a deterministic HTML+CSS page built from the
spec, screenshotted through the same provisioned headless Chrome the snapshot
machinery already owns, at the exact 1440×900 viewport the `source` capture
already opens.

Three agent tools land on the existing `remocn-library` server, auto-allowed
like the rest: `search_stock` finds Pexels photography through the sidecar's
own client (the key and the network never reach the agent),
`save_moodboard` downloads the curated picks, writes `spec.json`, renders the
board and stores it all as one ordinary library asset — preview, undo window
and insertion already work — and `get_moodboard` is the idempotence gate: an
existing board comes back as its ready spec and PNG, so the expensive
search-and-curate pass is never repeated unless the person asks to start over.
Iteration is the same save with one block replaced; the pipeline's brand stage
now calls for the board and works from its palette.
