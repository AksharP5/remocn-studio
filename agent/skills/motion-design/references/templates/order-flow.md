# Order Flow

Registry ID: `fomo-limit-orders`. Preferred export: `OrderFlow`;
`FomoLimitOrders` is a compatibility export. Graphite/amber is sample branding.

[Preview](https://remocn.dev/docs/templates/fomo-limit-orders) ·
[Docs](https://remocn.dev/docs/templates/fomo-limit-orders.md) ·
[Source JSON](https://remocn.dev/r/fomo-limit-orders.json)

Read `index.tsx`, `motion.ts`, `content.ts`, `ui.tsx` and the selected scene
under `registry/remocn-templates/fomo-limit-orders/`. Follow the
[source and adaptation procedure](index.md). Source clock: 1108 frames at 60 fps,
480×270 design surface. Read the root's time mapping: confirmation and closing
receive film time plus 1.85 seconds, while earlier scenes receive film time.

## Passages and their causes

| Range | Source | What to study |
| --- | --- | --- |
| 2.70–8.00s | `scenes/phone.tsx`, `phoneBorderPoint` in `motion.ts` | The camera establishes the device, follows an edge detail, and the light trace prepares the bright field. Device and trace share coordinates. |
| 8.00–10.90s | `scenes/slider.tsx` | Market/Limit roll → large bar reduces toward UI scale → values and knob change → surrounding details leave → bar contracts into a vertical caret. |
| 10.90–12.60s | `scenes/price.tsx` | Price controls assemble around the surviving caret; typed value and a targeted camera move direct attention into the result. |
| 12.60–18.47s | `scenes/confirmation.tsx`, `scenes/closing.tsx` | The order result fills and moves out, making room for the closing phrase and identity. Use the root's shifted scene clock when locating these movements. |

The slider-to-price passage carries one colored shape across two meanings. Width,
height, knob, surrounding labels and camera scale do different jobs. Width first
follows measured key values; the final contraction is a separate gesture around
10.483–10.883s. Its curve in `motion.ts` is specific to that contraction, not a
universal easing preset. Study the last slider state and first price state together.

## Transfer it

Use this for a control becoming a result, a graphic shrinking into a marker, or a
detail emerging from an established whole. Derive the incoming anchor from the
outgoing shape; preserve the sequence that clears secondary information before
the small carrier becomes the focus. Keep labels readable through the combined
camera and object transforms.

Recalculate geometry for the real interface, knob travel for the real range,
number formatting and typing/reading time for the supplied values. Some sample
calculations and timed numeric values live inside `scenes/slider.tsx`; changing only
`content.ts` does not replace the entire data story. Inspect those calculations
when adapting. Use actual product states and supplied brand assets.

## Recognize a weakened adaptation

If labels, knob and bar all fade together, the viewer loses the carrier that
connects the states. If the price panel starts at an unrelated anchor, the morph
reads as a replacement. If a new outer zoom competes with the price close-up,
inspect the composed screen-space motion and choose which movement owns focus.

Proof: include the bar before contraction, the caret handoff, the assembled price
and its reading interval. Compare the shape at intermediate points as well as
the endpoints; a plausible first and final frame can conceal a broken contraction.
