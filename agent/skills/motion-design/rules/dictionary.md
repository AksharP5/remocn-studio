# Movement dictionary

Classify actual behavior: `entry` introduces an element, `emphasis` changes or
accents an existing one, `exit` removes it, `scene` stages a shot and `transition`
connects states. A cut can show an already-present element or end a shot without
an animated entry or exit.

| Name | Implementation idea | Choose it when |
| --- | --- | --- |
| `fade-in` | Clamped opacity range | Appearance should preserve position and size |
| `rise-in` | Vertical travel, optionally with separate opacity timing | The spatial origin or graphic language suggests upward arrival |
| `slide-in` | Horizontal travel from an authored origin | The layout or neighboring state establishes that axis |
| `blur-in` | Filter resolves over a bounded interval | Focus is the intended reveal; test type in the export |
| `scale-in` | Scale from a chosen size with a curve or spring | Growth or depth carries meaning |
| `mask-reveal` | Content revealed through a separately owned mask | Content should be uncovered without changing its geometry |
| `type-on` | Character count driven by frame time | Typing is part of the action; reserve final layout if it should stay centered |
| `draw-on` | Stroke dash offset or scaling a bar from its origin | A path or relationship is being constructed |
| `count-in` | Numeric interpolation ending at the actual value | Accumulation matters; a known metric may appear complete |
| `decode-in` | Deterministic glyph substitutions, then exact text | Decoding belongs to the direction |
| `highlight` | Ground or color change around existing content | The current beat needs emphasis |
| `mark` | Authored annotation path | An annotation helps explain the subject |
| `shimmer` | One bounded light sweep | Material or an accent calls for sheen |
| `glitch` | Bounded deterministic displacement or channel offsets | Corruption belongs to the visual language |
| `swap` | Shared box and explicit ownership transfer | Content changes in one place |
| `burst` | Seeded particles at an event | A celebratory or physical accent is justified |

`fade-out`, `blur-out`, `slide-out` and `scale-out` leave through the corresponding
property. Choose duration and curve for the gesture; a travelling object can leave
at full opacity. Implement a new named component when no existing device fits.

New components follow the Studio's tunable schema contract. Curves are four-number
props sampled inside explicit windows; spring physics are exposed separately.
Keep transform and opacity windows separate when the reveal needs different timing.
