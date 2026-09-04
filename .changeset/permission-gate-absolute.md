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
