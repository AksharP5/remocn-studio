# Updating in place

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`shell/quit-and-updates`](../../openspec/specs/shell/quit-and-updates/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


`tauri-plugin-updater` against this repo's own releases; the endpoint is
`releases/latest/download/latest.json`, which GitHub resolves to the newest
release that is neither a draft nor a prerelease.

- **The updater signature is not optional.** `pubkey` is a plain required `String`
  in the plugin's config — there is no unsigned mode to choose. It is a minisign
  key from `tauri signer generate` and has nothing to do with Apple code signing,
  which the release job does separately since REM-413 (2026-09-14): the private
  half is the `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  repository secrets, and the CLI refuses to build when the configured pubkey has
  no private counterpart — or when the two do not match. The order in the bundler
  is Apple first: sign inside out, notarize and staple the `.app`, and only then
  make the `.app.tar.gz` from it, so what the updater installs is the stapled
  bundle and Gatekeeper never sees an unsigned one.
- **Step 4 stopped drafting because of this.** A draft's assets have no reachable
  download URL, so a drafted release can serve neither the manifest nor the
  `.app.tar.gz` it points at. Publishing on tag push is what makes the feature
  possible at all, not a change of taste.
- **`development` and `production` are different builds, and only one updates.**
  `studio_build` answers `{ environment, version }` off `cfg!(debug_assertions)`
  — the same signal `sidecar/spawn.rs` reads to decide where the sidecar script
  comes from — and `useUpdates` checks nothing at all in `development`. That is
  not politeness: in dev the executable is `target/debug/remocn-studio` rather
  than something inside a `.app`, and the plugin works out what to replace by
  climbing to `Contents/MacOS` from the current exe, so a check there fails on a
  path lookup and never reaches the network.
- **The two macOS jobs run one at a time.** `latest.json` carries a key per
  platform and tauri-action builds it by fetching the asset already on the release
  and merging its own entry in. Run in parallel, both fetch before either writes,
  and the loser's architecture silently vanishes from the manifest — an update
  that 404s for half the machines. `max-parallel: 1` is what makes the merge a
  merge, and it is the whole reason the matrix is serial.
- **Restarting is ours.** `Update::install` replaces the bundle and returns; it
  does not relaunch. `restart_studio` mirrors `quit_studio` in calling
  `confirm_quit()` first — otherwise the quit guard prevents `ExitRequested` — and
  additionally shuts the sidecar down by hand, because `AppHandle::restart` spawns
  the replacement and calls `exit(0)` itself, so the event loop never reaches the
  `RunEvent::Exit` where `Sidecar::shutdown` normally runs. `shutdown` guards on
  an atomic, so saying it twice costs nothing.
- **A missing build reading is not an error.** It means there is no core to ask —
  `bun dev` opened in a browser — and the row reads "Waiting for the Tauri core"
  instead of a transport message. A failed *check* does surface, inside the
  popover only, because a background poll must not put a banner on screen.
- **Progress is folded, not reported.** The plugin streams `Started` / `Progress`
  / `Finished` and each progress event carries only its own chunk length, so
  `advance` in `lib/studio/updates.ts` accumulates them into `{ received, total }`
  and is a pure function with its own tests. `Finished` settles `received` on
  `total`, or a bar whose last chunk was rounded away would stop at 99%.
