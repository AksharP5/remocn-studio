# Easing

Choose the gesture and its timing before the curve. A curve cannot repair a wrong
camera target or an unexplained state change. Inspect the approach, peak and settle,
not just the endpoints.

## Starting curves

These are optional implementation examples, not mandatory categories or measured
reconstructions of a reference. Keep their arrays editable through the Studio schema.

| Gesture | Starting curve | Scope |
| --- | --- | --- |
| Arrive and settle | `[0.33, 1, 0.68, 1]` | Useful for a restrained entry; not required for every appearance |
| Accelerating departure | `[0.32, 0, 0.67, 0]` | Useful when gathering speed out of frame |
| Move between resting positions | `[0.65, 0, 0.35, 1]` | Useful for a deliberate reposition |
| Constant-speed travel | `[0, 0, 1, 1]` | Mechanical or continuous motion, including a moving shot boundary |
| Physical response | Tunable spring damping, stiffness and mass | Use when a spring response belongs to the object's behavior |

A fall under gravity differs from a panel being placed downward. Let the intended
force decide whether it accelerates, brakes or rebounds. Overshoot is an expressive
choice, not a required flourish or a once-per-film allowance.

## Compose properties by their roles

Separate position, opacity and blur timing when they have different jobs. Preserve
spatial travel at full opacity when that keeps an object legible. Pure opacity can
be sufficient for an appearance. Related elements may use the same curve.

For a physical toss, an intermediate pose or arc can carry weight. A flat UI update
may need only its start and end. Use follow-through on parts that should flex or
lag; a rigid interface panel can move as one object.

A sampled reference does not uniquely identify its original easing. Record inferred
parameters as estimates and judge the rendered gesture. When a smooth move joins
another without a cut, inspect position and velocity around the join for unintended
jumps. A cut may intentionally reset both.
