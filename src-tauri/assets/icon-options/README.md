# Application icon concepts

Selected direction: **Violet**.

- `01-violet.png`: selected dark concept, white mark on violet shader.
- `01-violet-light.png`: matching light concept, violet mark on pale lavender shader.
- `02-obsidian.png` and `03-glass.png`: alternative concepts.

These are the original imagegen concept renders. The checkerboard around these
previews is baked in; they are not used by the application. Production masters
are `../../app-icon.png` and `../../app-icon-light.png`. Their backgrounds were
extracted with imagegen, then clipped to the original macOS icon contour during
Tauri's SVG-to-PNG export to remove edge artifacts. `original-icon.svg` preserves
that original contour and vector glyph for reference.

Light variant prompt: preserve the selected Violet icon's custom R silhouette,
scale, position, squircle geometry, and organic NeuroNoise filament arrangement.
Translate the surface to pearl-white and pale lavender with lilac shader threads;
use a solid saturated violet mark. Keep a front-on composition without labels or
extra objects. Generated with the built-in imagegen tool using `01-violet.png`
as the edit reference.
