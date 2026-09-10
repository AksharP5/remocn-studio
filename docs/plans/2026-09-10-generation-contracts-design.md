# Generation quality from the Wandry findings

The user approved implementing all five proposed improvements together: timing contracts, automatic event-boundary review, material-led scripting, reusable combinations and repeatable generation evaluation. The existing seven-stage code-generation pipeline remains the workflow; no extra user approvals, scene-spec renderer or style quotas are introduced.

## Implementation

1. Ship `studio-motion-v2` beside v1, leaving authored copies and existing films untouched. Pure plans expose entry completion, reading and group exit completion. Reusable phrases, image/caption, heading/details and card-to-grid combinations render from those same plans. Custom code can supply the same contract and retain its own visual treatment.
2. Emit a small runtime review manifest from the composition, plus identifiers on rendered targets. The browser audit discovers the manifest from the rendered tree, normalizes its local clock to composition time, prioritizes neighboring event frames and checks contracts against observed targets. Missing/invalid contracts and unvisited boundaries are explicit limitations, not proof of correctness. This supplements existing pixel, text and scene checks.
3. Use current report identity and coverage for the agent's review completion. Revalidate the stored report rather than trusting copied JSON or prose; preserve human export. Boundaries are derived from executable plans, not a second hand-maintained motion document.
4. Route new generation to v2. Script decisions connect the viewer's takeaway, actual source material, focal subject and reason for the next beat. Build proves the hardest combination with real content; overflow is resolved through content/layout/duration before shrinking reading windows. These decisions stay internal to Studio.
5. Add a small versioned evaluation corpus, including Wandry-like transitions and other film directions, with repeatable run records and comparison metrics. Mechanical fixtures render locally; quality preference and user corrections are recorded from real generations, never inferred from unit tests.

## Validation

Test the observed failure classes and their repaired variants: word-count-dependent exit overlap, group reading budget, caption removed before exit, stale reports and boundary sampling under a budget. Verify installation into existing projects preserves v1 and authored v2. Typecheck and render the new combinations with different content lengths and aspect ratios. Inspect transition frames, record limitations and provide the user a clear path to try a fresh generation.

## Alternatives considered

More prompt rules alone cannot verify executed timing. Replacing all creative code with fixed full-frame templates would narrow output unnecessarily. A small executable contract shared by custom and supplied components gives mechanical guarantees while keeping staging and art direction open.
