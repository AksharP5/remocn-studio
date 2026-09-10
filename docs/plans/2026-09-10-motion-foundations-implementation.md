# Motion foundations

The user approved the production-quality proposal on 10 September. The first
implementation supplies reusable movement and short sequences, connects them to
generation, and renders varied content to verify the actual result. UI cursor
choreography is outside this implementation.

1. Ship an owned, versioned `studio-motion-v1` module with the Remotion project
   resources. Use seconds, bounded group timing, explicit reading intervals and
   transition overlap. Preserve authored project copies when installing it.
2. Supply text, image and graphic sequences with shared timing and geometry,
   deterministic frame sampling and adaptable typography. Keep art direction and
   content separate from movement calculations.
3. Add executable timing/coverage diagnostics and a reproducible render matrix
   for short/long content, landscape/portrait and multiple FPS values. Inspect
   renders and fix failures; document the reference decisions and coverage.
4. Route generation to the supplied module and examples when they fit the brief.
   Preserve user direction, tunability and the existing technical review. Avoid
   requiring the user to choose low-level motion parameters.
5. Run module, scaffold and convention checks, type checks and production proof
   renders. Record limitations and distinguish render verification from a blind
   model-generation quality comparison.

The pinned upstream registry remains unchanged. A versioned resource module avoids
sync drift and lets existing videos retain their installed implementation.

Completed 10 September: runtime and installation, generation routing, reusable
sequences, deterministic checks and render matrix are implemented. Reviewed
renders exposed and resolved phrase overlap, a multiline-mask leak and metric
label collision. Final evidence: 190 tests, type checks, sidecar build, 11 renders,
412 event PNGs, 11 blank-start comparisons and 15 identical-time FPS comparisons.
Details: `docs/analysis/generation-quality-2026-09-09/motion-foundations.md`.
Model-generation preference and reduction in user revisions remain unmeasured.
