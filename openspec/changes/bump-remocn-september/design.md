## Context

`remocn/` is vendored from one upstream commit, and `sidecar/library/roles.ts` gives every shipped component one of five motion roles. `roles.test.ts` fails when a shipped component has no role, so the bump forces the classification.

## Decisions

**Roles follow the closest component already classified.**

- Phrase swaps and in-place rolls (`caret-swap`, `inline-word-roll`, `kinetic-morph-text`, `rush-type`) are emphasis, like `value-swap` and `rolodex-flip`.
- Endless loops that hold the frame (`perspective-squeeze`, `ring-text`, `type-wall`) are scene, like `infinite-marquee` and `perspective-marquee`.
- UI simulations (`cursor-gravity`, `keystroke`) are scene, like `simulated-cursor`. `keystroke` could also read as emphasis; the spec resolves an ambiguity outward, so it is scene.
- The shader backdrop `shader-light-tunnel` is scene, like every other shader. `shader-seam` and `shader-spiral-pass` take two scenes, so they are transitions.
- `radial-burst` is emphasis, like `confetti`.
- `typed-split-wipe` is exit. It builds and holds, but its distinguishing motion is the wipe that leaves.
- `type-fossil` and `type-repeater` begin with a word that is already readable and change it, so they are emphasis.
- The rest build a word or line from nothing, so they are entry.

**All previews are re-rendered rather than the ninety-nine old ones being kept.** Fifty-one of the ninety-nine existing components have different source between the two pins (their file hashes in `remocn/lock.json` differ), so their old clips can show motion the shipped source no longer makes. The sync clears every render, and one fresh pass from a single toolchain keeps the set consistent where restoring the other forty-eight from git would mix two.

**The preview script finds WebGL through a component's dependencies.** It used to give ANGLE only to a component whose own manifest named `@paper-design/shaders-react`. The first full pass failed 31 of 140 components with *WebGL is not supported* or *WebGL2 is unavailable*: dissolves that wrap a shader (`swirl-dissolve` → `shader-swirl`), filters built on `canvas-presentation`, and new shaders that open their own `webgl` context. Re-running those 31 with `--gl=angle` rendered all of them. The script now walks the registry dependencies and takes ANGLE when any item in the closure depends on paper shaders or calls `getContext("webgl…")`. That selects 51 components, a superset of the 31.

**`type-wall` is encoded at crf 28.** At the default crf 18 its clip was 4.4 MB, above the largest clip in the old set (3.1 MB); at crf 28 it is 0.9 MB. All 140 posters and clips total 44 MB, against 43.9 MB for the old 99.
