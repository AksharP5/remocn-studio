# Product Showcase

Registry ID: `launch-anything`. Preferred export: `ProductShowcase`;
`LaunchAnything` remains compatible. Current defaults use cream, forest green,
original photographs and generic product examples.

[Preview](https://remocn.dev/docs/templates/launch-anything) ·
[Docs](https://remocn.dev/docs/templates/launch-anything.md) ·
[Source JSON](https://remocn.dev/r/launch-anything.json)

Read `index.tsx`, `motion.ts`, `content.ts`, `screens.tsx` and selected scenes
under `registry/remocn-templates/launch-anything/`. Follow the
[source and adaptation procedure](index.md). Source clock: 1600 frames at 60 fps;
motion helpers sample absolute seconds on a 480×270 design surface.

## Passages and their causes

| Range | Source | What to study |
| --- | --- | --- |
| 0–3.80s | `scenes/opening.tsx` | Material type changes scale and background; actual imagery carries the opening mood. Read the shader-text-reveal dependency before adapting it. |
| 3.80–7.33s | `scenes/action.tsx`, `scenes/action-frame.tsx`, `scenes/portal.tsx`, `actionFrame` in `motion.ts` | Title leads to a button; press, reposition and shape growth turn that button into an aperture for the showcase. |
| 7.33–15.12s | `scenes/showcase.tsx`, `screens.tsx`, `deskCamera` and `showcaseTimeline` | Seven demos change inside a persistent laptop while one camera move develops the scale. |
| 15.12–21.55s | `scenes/proof.tsx`, `scenes/industry.tsx`, `scenes/space.tsx` | Symbol field, architectural linework and short photographic cuts change density and pace before the close. |
| 21.55–26.67s | `scenes/closing.tsx` | Address resolves through typing/light and the frame mark settles into the ending. |

The action and portal share `ActionFrame`; their sequence boundary does not reset
its geometry. In the showcase, content changes inside an established container.
Camera travel survives the individual screen changes, so the montage develops
within one space. Study both the container's motion and the screen's own action.

## Transfer it

Use the portal for a meaningful entry into a product or collection. Use the
continuous showcase for multiple works whose presentation benefits from a common
frame. Keep the shared element's anchor and clock continuous across the handoff.
Adapt demo count, cuts and camera targets to the actual works; seven is sample
content. Longer explanations need more inspection time than quick visual samples.

The laptop is drawn separately from the photographic workbench. Replacement
images need compatible space, lighting and crop. `screenImages` uses cover with
an approximately 1.52:1 viewport; inspect important content after cropping.
Legacy media keys `rocket` and `earth` now default to sculptures and a courtyard.
Use the actual images when planning the story. The chrome opening requires WebGL2.

## Recognize a weakened adaptation

Recreating the portal as unrelated entry/exit layers can jump at the handoff.
Resetting the camera for every work makes repeated screen changes feel like
separate demonstrations. An outer slide can hide the very screen animation chosen
as the highlight. Inspect the composed shot and set the source in-point so the
main action is visible once the container has an intelligible position.

Proof: cover the aperture handoff or at least two successive works with the
continuing camera. Compare intermediate shape, crop, material and relative
motion; matching the words and cut timestamps alone does not reproduce the shot.
