# Turn output and video review

Approved direction: show short tool labels and diagnostic summaries, preserve raw
logs on disclosure, and distinguish unsuccessful tool execution from findings
about the generated video. The user explicitly wants to see what design_check
discovered, using a review presentation instead of error styling.

Design checks stay visible outside collapsed activity runs. A completed report
shows improvements, cautions and observations, including the actual finding,
affected frames/selector and recommended change. Coverage, cancellation and stale
reports remain explicit; no findings is not a claim that every frame is correct.
Malformed output and execution failures retain the ordinary tool detail fallback.
No stored severity or review gate changes: this is a presentation distinction.

Implementation and validation:
1. Parse a small validated projection of saved/live review results; render a
   neutral review card with expandable findings and raw report.
2. Extract meaningful failure lines, shorten MCP/shell labels, retain full inputs,
   and consolidate consecutive identical failed attempts without reordering history.
3. Correct the registry wrapper return type in the template and onboarding.
4. Run regression tests for report findings vs tool failures, incomplete reports,
   history grouping and browser failure extraction; run project type checks.

Do not infer that a failed shell command was repaired from a later unrelated
success. Existing authored registry files must not be overwritten wholesale.
