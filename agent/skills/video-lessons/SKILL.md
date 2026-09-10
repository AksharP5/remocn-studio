---
name: video-lessons
description: >
  Diagnose Remotion implementation and render defects: font fallback, text jitter,
  local-frame timing, transition seams, wall-clock CSS, WebGL output and export
  reproducibility. Consult the relevant technical reference while implementing
  those features or reproducing an observed defect.
---

# Video implementation lessons

These are historical observations from Remotion 4.x, headless Chrome and several
project-specific components. Exact package versions and render settings were not
recorded for every old observation. They are diagnostic leads, not universal
render requirements or artistic direction.

## Diagnose before applying a workaround

1. Reproduce the symptom in the actual composition and export settings. Inspect
   the affected consecutive frames, not only a settled still.
2. Identify the component, local/global frame, asset and installed version involved.
   Read only the relevant reference below and verify against the current code/API.
3. Correct the owning cause: the component schedule, upstream event, shared anchor
   or rendering behavior established by the reproducer. Follow its dependencies
   into affected neighbors; a local symptom may require updating their timing or
   geometry together. Preserve the intended appearance and inspect that interval again.
4. Record the reproducer, environment, fix and verification with the video. A fix
   is complete when the observed defect is resolved without changing the intended
   event, geometry or identity.

| Reference | Read for |
| --- | --- |
| [Text and fonts](references/text-fonts.md) | Fallback faces, wrapping, glyph shimmer or baseline jitter |
| [Timing and transitions](references/timing-transitions.md) | Wrong local clock, blank states, masks or transition seams |
| [HTML and graphics](references/html-graphics.md) | CSS/portal behavior, layout, shaders or 3D rendering |
| [Rendering](references/rendering.md) | Export settings, reproducibility, media and dependencies |
| [Optional recipes](references/recipes.md) | Implementing an already-chosen settle, slide, orbit or morph |

The Studio conventions own composition registration, editable schemas and tool
contracts. The brief and brand own the visual direction. Recipe numbers are scoped
examples; a prior preference for one font weight, text axis, backdrop, opener or
transition is not a requirement for another film. Use `motion-design` for staging
and reference comparison, including valid still holds and locked cameras.

When adding a lesson, record symptom, applicability, evidence, correction and a
counterexample. Keep a user/brand preference with that user or project. Remove a
workaround when the installed runtime no longer exhibits the defect.
