# Opening a link

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`projects/open-template-link`](../../openspec/specs/projects/open-template-link/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


`remocn-studio://` is the app's URL scheme, and it has one handler:
`remocn-studio://open-template?template=welcome-early-member&props=<base64url JSON>`,
the link the landing's thank-you page writes (REM-371, for REM-360). It creates a project
from a bundled template with the props from the link, and opens it on the player. It works
from a cold start and into a running app, and it works signed out and on Free — the
template is not a Pro feature; the Pro gate is on skills and the pipeline, not on opening a
file.

- **The link can name nothing but a template and its props.** `parseDeepLink` in
  `shared/deep-link.ts` is the whole reader: the scheme, the one route, a template name
  checked against `PROJECT_TEMPLATES`, and props decoded through the Effect Schema in
  `shared/templates.ts` — a mirror of the composition's own zod schema, and
  `shared/templates.test.ts` decodes the same values through both so the two cannot drift.
  Anything else — another scheme, a route the studio does not have, an unknown template,
  props that are not base64url, not JSON, or not the shape — is a toast and no project.
  Keys the schema does not declare are dropped, so nothing in a link reaches a file that
  the schema did not put there. The base64url is the landing's exact spelling: UTF-8 JSON,
  `+/` → `-_`, padding stripped.
- **The core keeps a queue, and the webview drains it.** `tauri-plugin-deep-link` delivers
  a URL on macOS as `RunEvent::Opened`, which fires in the run loop — after `setup`, and
  for a cold start before any page is listening. So `links.rs` pushes every URL onto a
  `DeepLinks` state and emits `app://deep-link` as a nudge; `useDeepLinks` calls
  `take_deep_links` once on mount and again on every nudge, and the two cases are one
  path. `get_current()` in `setup` is the Windows/Linux half, where the URL is argv.
  `tauri-plugin-single-instance` goes first in the builder, with its `deep-link` feature,
  which forwards a second launch's argv to the deep-link plugin before our callback
  focuses the window.
- **The scheme is registered by the bundle, not at runtime.** macOS reads
  `CFBundleURLTypes` from the `.app` — generated from `plugins.deep-link.desktop.schemes`
  in `tauri.conf.json` — and there is no runtime registration on macOS, so a link does
  nothing against `bun tauri dev`. Verify with a built bundle: `bun tauri build --no-sign
  --bundles app`, open the `.app` once so Launch Services sees it, then
  `open "remocn-studio://open-template?…"`. Windows is the registry and Linux a `.desktop`
  entry, both written by the plugin's own installer hooks.
- **`project.fromTemplate` is the wizard's gesture with the video already written.** It
  mints a free folder under `~/Movies/Remocn Studio` — `Welcome — ‹name›`, then `… 2`,
  `… 3`, because opening the link twice must not land in the first project's tree where
  the copy would skip every file and keep the first props — expands the project template,
  places the registry, expands the *video template* into `src/videos/welcome-early-member/`
  with the props stamped into `__TEMPLATE_PROPS__` in its `index.tsx`, merges the pins the
  composition needs into `package.json`, and creates the video row. The webview then does
  exactly what `createProject` does — remember, `startScaffold` (which re-expands, a no-op,
  and installs), expand the video, start a chat — so the install progress and the Retry are
  the ordinary ones. `~/Movies` rather than `~/Documents` because Documents is a TCC-guarded
  folder and the first write there would raise a system prompt in the app's name.
- **The template is a copy, synced by hand, and formatting it is off.**
  `templates/remotion/video-templates/welcome-early-member/` holds the landing's
  `remotion/welcome-early-member/` verbatim — the composition, its zod schema, the five
  `components/remocn/*` it uses and the wordmark glyph — with only the `@/` imports made
  relative, and a header naming the original. Until the composition is published to the
  remocn registry, a change on the landing is a change here by hand; the folder is
  force-ignored in `biome.jsonc` for the same reason `agent/skills` and `remocn/` are, so
  the next sync is a copy and not a merge. Its `index.tsx` is the video module the scan
  expects: `meta`, a default export, and now `defaultProps` and `schema`, which
  `registry.tsx` forwards to `<Composition>` — the preview already passes a composition's
  `defaultProps` as the Player's `inputProps`, so the name and the number from the link are
  what plays.
- **The pins ride on the project's own Remotion.** `@remotion/google-fonts` is added at the
  template's `remotion` version — Remotion refuses a mix across its packages — and
  `@paper-design/shaders-react` at the release the landing resolved; `zod` is already in
  the template. The fonts load from Google at preview time, as they do on the landing.
  What is not measured here: the neuro-noise shader under the export's headless Chrome,
  which has no GL by default (see *Taking a picture of the frame*); the acceptance
  criterion is the Player, and a still or an export of this video is the project's
  `remotion.config.ts` to settle.
