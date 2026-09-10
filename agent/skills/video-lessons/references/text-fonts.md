# Text and font rendering

Scope: historical Remotion 4.x/headless Chrome observations. Font, browser, GPU,
scale and component implementation can change the result. Reproduce the defect
before adopting a workaround; the values below are not universal thresholds.

## Fallback or wrong metrics

- Wait for the actual font faces before rendering and measuring text. Check the
  installed font-loading API and composition mount lifecycle. In earlier projects,
  an incorrectly timed module-scope load completed too early for the capture;
  gating the composition on font readiness fixed the fallback. Do not assume every
  module-scope `loadFont` is broken.
- Recompute canvas measurements after font readiness. A guessed em multiplier or
  cached system-font metric can overlap words when the real display face arrives.
  Compare the measured line with a full-resolution still.
- Verify the loaded file, weight and glyph coverage. If the brand supplies only a
  Roman 400 face, avoid accidental synthesized bold; choose supported typography
  or acquire the required face. A missing arrow can fall back mid-line; an authentic
  SVG icon is an option when the face has no suitable glyph.
- Preserve approved local font assets and their provenance. Match names to actual
  files; a claimed family name alone does not prove the pixels use that face.
- Tabular figures affect punctuation in some fonts. Inspect the actual metric;
  adjust layout or choose supported number styling rather than dropping meaningful
  punctuation or units to make a particular component fit.

## Shimmer, row snapping or changing geometry

Slow vertical travel and continuous scale caused baseline snapping in earlier
exports. Diagnose at the target resolution on consecutive frames. First remove
movement that has no role. For required movement, test wrapper transforms, font
readiness, render scale and compositing independently. Horizontal travel is an
alternative only when it preserves the selected gesture; there is no X-only rule.

Earlier experiments found `willChange: "transform"` and a higher render scale
helpful for some settled text. A tiny rotation hack helped one case and harmed
another. Do not add these globally or call them verified for a different runtime.

A multi-line block often needs one transformed wrapper to preserve line geometry.
Keep inner text plain when separate promoted glyph layers produce shimmer. Per-word
travel can overlap adjacent words; inspect the beginning and end of every stagger.

For a reveal that should keep its final layout, reserve the final box and reveal
through opacity or a mask. Animating width can move the center and wrapping during
the reveal. That can also be intentional: choose which geometry should remain fixed.

A centered type-on line needs its full width reserved if it should not recenter with
each new character. `text-indent` inherits into inline-block word spans; explicitly
reset it where unintended gaps appear. Measure actual spaces and line boxes.

## Verification

Inspect the same text at delivery size, maximum camera magnification and the
problematic transition. A low-resolution preview can hide a fallback or invent
apparent softness. Frame differences can localize a jitter spike, but distinguish
intended motion from unstable rasterization; a scalar difference is not a verdict.
