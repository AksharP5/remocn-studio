---
"remocn-studio": patch
---

Make the permission gate absolute in Accept edits and Plan. Claude Code's own
classifier approved a tool call before `canUseTool` was ever consulted, so a Bash
command in either mode ran with no Allow/Deny card — measured: `ls src/videos`
produced a tool row and nothing else. A `PreToolUse` hook now runs the same review
ahead of that classifier and routes the calls that want a card into the existing
gate. `auto` is unchanged, where the classifier deciding first is the trade that
mode is. A stream chunk the webview cannot decode is also no longer dropped in
silence — that is what made this impossible to diagnose from the logs.

Say why a turn did not run in the mode it was given, and stop the Mode chip
claiming one it did not. Haiku 4.5 does not offer Auto — Claude Code downgrades
it to `default` and only the notice said so, in words that read as a fault in the
studio. The notice now names the model, the chip reports the mode the turn will
really run in, and the menu's Auto row carries the reason it cannot be picked.
The session keeps the mode that was chosen, so a model with Auto brings it back.
