# HTML, layout and graphics

Scope: historical component/runtime observations. Verify the installed component
and reproduce on rendered frames before carrying a workaround to another project.

## Frame-driven HTML

- Wall-clock CSS transitions/animations can disagree across seeked frames. For
  components that exhibit this, disable the wall-clock behavior in the video scope
  and drive the required motion from the frame. Compare consecutive captures as
  well as direct seeks.
- Date-dependent UI needs explicit date/month/selection inputs when it should be
  reproducible. Seed random behavior rather than relying on current time.
- Portals can escape a transformed camera plane. Use the primitive's supported
  container or an inline version when the popover should remain inside that plane.
- Verify computed font and theme variables on the scope itself. Self-referential
  variables and inherited computed styles can leak the wrong face or background.
  Check both supported themes when the shot changes theme.
- Absolute-fill components need an intentional positioned parent and dimensions.
  Earlier number/typography components centered over the whole scene when inserted
  into ordinary flex flow. Inspect the component root before compensating with offsets.
- A syntax highlighter may tokenize numeric literals incorrectly. Check the actual
  rendered code, including minus signs, separators and units; source correctness
  alone does not establish display correctness.
- Translucent cards can lose readability over live content. Choose opacity for the
  intended material and actual contrast instead of applying a universal glass ban.

## Layout and masks

A zero-width flex child can still contribute a gap. If a reveal should recenter
without an empty gap, keep that spacing inside the revealed region. A clip-path
changes visibility, not layout size; derive compensation from the hidden width
when the visible lockup should remain centered.

Construct valid CSS values and inspect computed styles when a gradient disappears.
Newlines alone are not a general CSS error. Check syntax, units and the generated
value rather than diagnosing from its formatting. For gradient masks, distinguish
the gradient axis from the direction of its bands. Project decorations and the
mask front through the same screen-space geometry.

## WebGL and 3D

If a shader is black or a render differs from preview, inspect the browser/GPU backend
and capture logs. Earlier projects needed `--gl=angle`; CLI configuration and a
Node render script may need separate settings. Test the selected backend instead
of assuming a flag guarantees determinism on every machine.

Inspect the actual shader defaults: a liquid-metal component may draw a shaped card
rather than a full-screen field, and a dither component's default shape may not be
the intended dissolve. Match shape, color range and reveal visibility to the shot.

For caustic filaments in the historical shader, highlighting the zero-crossing set
with an expression such as `exp(-abs(c))` produced veins; a positive-only power
produced a flat field. This is specific to that shader expression.

For three.js, derive scene/camera state from frame time. A render-loop mutation can
race capture; a mid-scene canvas mount can expose a black frame. Inspect tone mapping,
color management, transparency and lighting before compensating with brighter assets.
Flipping an SVG-derived mesh axis can reverse winding/normals; inspect its geometry.
A CSS filter on a 3D ancestor can flatten intended depth: place compositing effects
with that behavior in mind.

At high zoom, inspect screen-space border and stroke widths. SVG
`vectorEffect="non-scaling-stroke"` is useful when a contour should retain its screen
width. Cull objects before a perspective singularity sends them across the frame.
For large swarms, compare canvas/SVG with thousands of positioned text elements.
