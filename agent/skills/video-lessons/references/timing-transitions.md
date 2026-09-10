# Timing and transition defects

Scope: inspect installed Remotion and component code. Timing behavior of custom
transition rails, counters and charts is not a contract for every component.

## Local clocks and bounds

- `Sequence` rebases the frame for its descendants. Keep absolute event anchors
  explicit and convert to local frames at the boundary. A global-frame condition
  inside a local sequence can leave an entire state blank.
- A custom transition rail may leave children on the global clock; inspect the
  implementation before applying offsets. Do not add a second offset by habit.
- A self-pacing number or chart may derive progress from a containing duration.
  Inspect that denominator before increasing speed: earlier demos completed under
  entry blur and looked static because their local window was already short.
- A loop's final iteration may be shorter than a full cycle. Verify entry/exit
  ranges against that remainder. Ascending interpolation ranges and explicit
  handling of an absent exit prevent failures only visible in a full render.
- A modulo cycle with a negative offset can start at its last item. Clamp or anchor
  the event clock so the opening state is the intended one.
- An odometer should reach exact digits at rest. Fractional higher-place values
  can park between glyphs; derive each column's start, integer travel and final
  digit, then test carry boundaries.

## Transition presentations

An entering presentation can remain mounted at its final progress. At completion,
remove temporary masks/overlays or make the final wrapper equivalent to the intended
resting state. Do not fade the actual incoming scene while clearing its cover.

Entering/exiting presentations can nest. Their opacity, transforms and masks
compose; a local progress context may describe a different presentation than the
one the child expects. Inspect both directions and the nested case. A custom
sequencer can be appropriate when plate and content have different lifecycles.

An entering layer may composite above the outgoing one. A reveal-from-behind needs
explicit ownership of both surfaces; reversing a scalar progress alone may not
reverse their stacking. Presentation APIs may expose normalized progress rather
than a local frame count: derive time from the actual chosen transition duration.

## Masks and handoffs

For a wipe that reveals content, apply complementary masks from one shared progress
and geometry. A moving transform also moves its mask coordinate system; keep mask
and content transforms on separate layers when the reveal front must stay aligned.
Apply the mask to the intended crop box, not accidentally to oversized children.

Inspect the seam while both sides are active, including early and late progress.
A delayed incoming layer plus an early outgoing fade can expose a blank background.
Use actual coverage to decide ownership; do not assume all wipes are immune to gaps.

For match cuts and dives, align the visible geometry, fill and border model at the
handoff. Percentage translations resolve against each element's width and height;
compute actual clearance for a diagonal move rather than assuming 100% means offscreen.
A shadow ring and a CSS border do not necessarily produce the same layout bounds.

For a shared shader surface, both sides need matching time and parameters if the
boundary should be invisible. A superseded surface leaves once its replacement
covers it. The surface can also change deliberately as part of the direction.

## Verify the readable interval

Sequence duration is not reading time. Inspect visibility after entry, masking,
camera travel and transition overlap. Test the first frame, both sides of every
handoff and the final state. Still holds, direct cuts and a composed frame zero
are valid; the defect is an unintended missing or unreadable state.
