# Optional implementation recipes

Read only after the visual device has been selected. These examples came from
individual 30fps projects. Their numbers are tunable starting points, not defaults
for all films. For a direct cut or quiet title, none may be needed.

## Group settle

For a compact graphic transition, a previous film shrank the outgoing group to 0.84
over 6 frames, then brought the next group from 1.24 with a spring configured around
damping 30, stiffness 320, mass 1. Inspect geometry and reading time before reusing
it. Multi-line text should remain one group if separate scaling pulls lines apart.
A required pause or a different material may call for a much slower or absent settle.

## Shared-axis slide

An outgoing panel and incoming panel can follow one axis. Choose overlap based on
whether they should coexist or replace each other; sequential visibility helps when
translucent duplicates become distracting. Derive both windows from one transition
clock and verify actual coverage. Full-opacity travel is valid for a solid panel.

## Physical toss

Use one travel parameter for horizontal position and a vertical arc such as
`4 * t * (1 - t)`. Rotation may settle later when the object's physical character
calls for it. A UI panel that simply changes location can remain rigid and direct.

## Continuous camera tour

Keep the camera on one absolute timeline when it moves between locations in one
space. Inspect the position and velocity where moves join. Holding the camera while
a tile plays can keep its text crisp. New shots can instead reset their framing;
a continuous rig is not a film-wide requirement.

## Closed-path morph

If paths twist despite reversing one winding, inspect their starting phase and point
correspondence. One historical solution resampled closed contours to equal-sized
rings, normalized winding by signed area, rotated to the closest matching phase and
interpolated corresponding points. Verify silhouettes through the whole interval;
complex topology changes may require different geometry or a different transition.
