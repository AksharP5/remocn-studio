# The first second

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`shell/startup`](../../openspec/specs/shell/startup/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


The main Tauri window starts hidden and the static export already contains the
in-window splash. A `beforeInteractive` script asks the Rust core to reveal the
window on the second frame after `DOMContentLoaded`; a 1.5-second Rust fallback
shows it even if the page fails before making that request. The native window
background is `#111111`, the sRGB result of the dark `--sidebar` mix, so live
resize cannot expose the system's light window colour.

The splash covers two independent startup waits: settings hydration and the
first `project.list` result. The latter takes roughly 0.7–1.0 seconds because
the sidecar itself reaches `ready` about 0.6 seconds after spawn; before this
guard, that empty initial project array briefly rendered onboarding for a
returning person. The splash stays for at least 1.5 seconds so its draw lands
and holds long enough to be seen,
then dissolves once both waits settle. A six-second cap reveals the shell and
its sidecar status instead of letting a failed sidecar hold the window hostage.

**A list that failed is not a list that is empty** (REM-314). On a failed `project.list`
the projects stayed `[]` and loading settled, so the shell fell through to first-run
onboarding — telling a returning person their work was gone, and offering New Project,
which would have failed the same way with nothing connecting the two. `listError` on
`useProjects` is the list's own failure, apart from `projectsError`, which also carries a
folder that would not open and leaves the list intact; the conversation renders *The
project list could not be read* with the message and a Try again, and the startup
backdrop stays off. The splash still dissolves — the card is the honest screen, and holding
a splash over a known failure only delays the news.

Keep the splash in the page's static HTML. Moving it behind hydration restores
the empty first paint; moving it to a second Tauri window turns the one dissolve
into a jump cut.
