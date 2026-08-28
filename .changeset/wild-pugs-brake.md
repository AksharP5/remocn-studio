---
"remocn-studio": minor
---

Crash reporting through Sentry, off until it is switched on.

A Rust panic, an unhandled rejection in the sidecar and a React render that
throws now reach Sentry — and only with the person's consent, which is opt-in
in Settings › Behavior and initialises no SDK at all until it is given. Paths
are stripped of the home directory before anything is sent; prompts, agent
conversations, project sources, breadcrumbs and the machine's hostname are
never attached. A development build reports nothing whatever the switch says,
and so does any build carrying no DSN — which is every build until the Sentry
project exists, so this release behaves exactly as the last one did.

`bun run crash:verify` measures all of it against a local stand-in for
Sentry's endpoint, with no account needed.
