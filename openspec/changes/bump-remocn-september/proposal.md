## Why

The bundled remocn set was pinned at `0797bfe` when the components pane landed (#43) and never moved. Upstream `Remocn/remocn` is 47 commits ahead at `8ae853e` (2026-09-30): the August and September components, and changes to the source of fifty-one of the ninety-nine already shipped. The library shows a set two months old.

## What Changes

- **The pin moves to `8ae853e`** in `scripts/remocn-sync.ts` and `scripts/remocn-previews.ts`, and `remocn/` is re-vendored from it.
- **Forty-one components join the library**, all in the five categories the studio already shows: thirty-four Typography, three Transitions (`lens-zoom`, `shader-seam`, `shader-spiral-pass`), one Shader (`shader-light-tunnel`), three Effects (`cursor-gravity`, `keystroke`, `radial-burst`). The shipped set goes from ninety-nine to a hundred and forty; nothing leaves it.
- **Each new component carries a role** in `sidecar/library/roles.ts`, so none appears in the unclassified group.
- **Every poster and clip is rendered again** from the new pin. Fifty-one existing components changed upstream, so their old renders no longer show them, and the sync clears every render it replaces.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `library/components-and-roles`: the shipped-set scenario's counts.

## Impact

- **Shared contract**: none. No protocol bump.
- **Sidecar**: `sidecar/library/roles.ts` only; `bundled.ts` reads the new `remocn/index.json` as it is.
- **Rust core, webview**: none.
- **Resources**: `remocn/` grows by forty-one folders, each with its sources, manifest, poster and clip.

## Non-goals

- **The new Motion Graphics category upstream.** The sync takes five categories by design; adding a sixth is a product decision about the components pane, not part of a pin bump.
- **The vendored agent skills.** `bun run skills:check` already reports them up to date with upstream, the `remocn` skill included.
