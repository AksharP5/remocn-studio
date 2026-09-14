# Workflow Console

Registry ID/export: `workflow-console` / `WorkflowConsole`. This is the renamed
X Ads MCP template; resolve the current ID instead of installing the historic one.

[Preview](https://remocn.dev/docs/templates/workflow-console) ·
[Docs](https://remocn.dev/docs/templates/workflow-console.md) ·
[Source JSON](https://remocn.dev/r/workflow-console.json)

Read `index.tsx`, `motion.ts`, `content.ts` and the selected scenes under
`registry/remocn-templates/workflow-console/`. Follow the
[source and adaptation procedure](index.md). Source clock: 2810 frames at 60 fps,
18 chapters, a 480×270 design surface. Scene IDs and some prop names preserve
history; defaults now describe release automation and environment diagrams.

## Passages and their causes

| Range | Source | What to study |
| --- | --- | --- |
| 2.20–10.70s | `scenes/commands.tsx`, `scenes/responses.tsx` | A request is written, context is fetched, and analysis answers that request. The response is the reason for the next action. |
| 10.70–16.80s | `scenes/commands.tsx`, `scenes/geography.tsx` | A ship command opens the environment carousel. Masked inactive items give context while the active topology owns attention. |
| 16.80–24.00s | `scenes/tools.tsx`, `scenes/terminal.tsx`, `scenes/responses.tsx` | Execution progresses into rollout and confirmation. `toolRunExit` clears the log before the next chapter. |
| 31.40–40.80s | `scenes/responses.tsx`, `scenes/commands.tsx`, `scenes/chart.tsx`, `recommendationCamera` in `motion.ts` | Recommendation → scaling command → throughput comparison. A continuous camera target follows the recommendation before the chart supplies evidence. |
| 40.80–46.83s | `scenes/titles.tsx`, `scenes/mark.tsx` | The result resolves into the closing statement and the same node-based identity. |

The transferable structure is a chain of questions, actions and answers. Each
command changes what evidence the viewer expects next. The recommendation camera
combines travel and zoom on a continuous target; two independently restarted
camera moves can introduce a visible change of velocity at their join.

## Transfer it

Use it for a CLI, automation, developer tool or a process where execution and
results are the product evidence. Choose only the chapters the actual workflow
needs. Keep a camera's reading target derived from the rendered command geometry
when font, text or layout changes; the source's character-width arithmetic assumes
its own typography.

Use `terminalRows`, content and environment overrides for real steps and labels;
inspect scene-relative row times separately from absolute film time. Match metrics
to the narrated action. For a larger bar count, recompute the last arrival and
result hold from all bars instead of copying the two-bar sample's cut time.

## Recognize a weakened adaptation

Typing unconnected commands and results creates activity without an understandable
workflow. A camera that keeps the original target after copy changes can follow
empty space. A newly added caption can compete with the carousel's active label.
Inspect the actual attention path and connect each result to its preceding action.

Proof: include one request through its readable answer, plus the camera join or
diagram change the direction depends on. Check command readability and compare
chart proportions to the supplied values; a smooth transition cannot validate data.
