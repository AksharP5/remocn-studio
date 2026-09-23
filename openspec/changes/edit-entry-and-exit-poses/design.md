## The rule

A move between poses A and B renders `A × (1 − p) + B × p`. Binding B with
multiplier `p` and offset `A × (1 − p)` (or the reverse) is the existing v5 two-pose
contract; the helper always binds the pose with weight ≥ 0.5, so the inverted
mapping never divides by less than a half and overshooting easings stay positive.
The consequence the person sees: on the first half of an entry the drag edits the
start pose, on the second half the resting pose; an exit mirrors it. Agreed on
2026-09-23 over an explicit Start/End switch.

## Staying in v5

The helper only calls the public `object.number` and `object.geometry` of a v5
object, so `index.tsx`, the document and the operation log are untouched and the
native compiler's v5 transport adapter still matches. `between.ts` is a new file in
the versioned folder; `copyInto` writes missing files and keeps authored ones, so
opening an older project adds it without changing its film.

## Drawing

The helper writes `data-studio-geometry-between` with the edited side, the kind
and both poses' values. `geometryTarget` reads it into `between`. The bound pose is
the target's own values (so it follows a drag); the other comes from the
attribute. Both are parent-space boxes; they are projected through the element's
current rendered centre, the parent rotation and the parent scale, which is the
same mapping the gesture uses. The other pose is a dashed, translucent box; the
path is a dashed line between the two centres. Local motion scale at an endpoint is
not known and is not drawn. The label is prefixed with the pose's name.

## Going to the other pose

`frames: {from, to}` are the scene-local frames at progress 0 and 1; the helper
passes them through. The editor converts with the element's own local frame
(`data-studio-geometry-frame`) and the Player's frame:
`global = current − local + frames[other]`, and seeks through a new optional
`Stage.seek` that pauses, cancels a replay and clamps. The outline is a button
only when frames are known and no gesture runs; its pointer-down is claimed by
the geometry editor so it never becomes a pick, and its click is exempt from the
pick-swallowing handler. Entries usually start transparent, so the opacity floor
in `geometryTarget` is removed: it only decides whether the *selected* object
gets handles. Picking still ignores what does not paint.

## Editing a pose you cannot see or hit

At a start pose the object is often transparent and outside the frame, where the
video may still clip it, so a pointer-down there reaches the canvas instead of the
object: the camera panned and nothing could be edited. Inside the selected
object's (rotated) frame, a pointer-down that does not land on other video content
now drags the selection, and the camera does not pan over a selection box. A
selected object whose own opacity is below 5% is shown at 45% in the editor only
(an attribute and an overlay stylesheet, re-measured on every paint without the
override) and its label says "transparent here". Rendering and export are unchanged.
