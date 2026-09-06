---
"remocn-studio": minor
---

The app answers `remocn-studio://` links, and one of them makes a project.
`remocn-studio://open-template?template=welcome-early-member&props=…` — the
link the landing's thank-you page writes — creates `Welcome — ‹name›` under
`~/Movies/Remocn Studio`, with the welcome composition copied in as its first
video and the props from the link written into that video's `defaultProps`, and
opens it on the player. It works from a cold start and into a running app, and
it works signed out and on Free: the template is not a Pro feature.

A link that is not one of ours, names a route or a template the studio does not
have, or carries props that are not base64url JSON in the shape the composition
declares, raises a toast and creates nothing. The link can carry no path and no
command: only a template name from the list, and props.
