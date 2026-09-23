## 1. Hosting boundary

- [x] 1.1 Add a connection-owned preview surface channel and preserve decoded message delivery in use-preview.
- [x] 1.2 Move iframe messaging into its own adapter and expose attachment/focus for a native surface, with explicit host selection independent of iframe mount timing.
- [x] 1.3 Add pure camera coordinate, anchored zoom and occlusion-aware Fit operations.

## 2. Embedded project runtime

- [x] 2.1 Add a native bundle/manifest with project webpack loaders, scoped CSS and explicit asset URLs.
- [x] 2.2 Add project-owned runtime mount/dispose and preview-only update recovery, without executing the page render entry in the app.
- [x] 2.3 Add the Shadow DOM host and canvas lab with a dedicated lifecycle hook.

## 3. Canvas and editing

- [x] 3.1 Add pan/zoom controls and fixed playback and floating properties layers through a canvas hook.
- [x] 3.2 Adapt the project-owned studio-objects transport for native hosting, then scope picking, geometry, text editing and the real inspector/overlays to the surface.
- [x] 3.3 Wire Snapshot, Docs, fullscreen, save receipts and Undo through the shared runtime and existing hooks. Runtime evaluation of all five videos remains under 4.2.

## 4. Delivery

- [x] 4.1 Package the new runtime resources and add a changeset describing the main-app migration.
- [ ] 4.2 After the user enables verification, cover stale connection/disposal, iframe regressions, camera boundaries, native bundling, reload/media cleanup, and packaged resources; run bun run check, bun run typecheck, touched tests and the full suite. No verification commands or new tests have been run/written under the current no-checks instruction.
- [x] 4.3 Promote the canvas to the main application under the user’s explicit request, mount the real inspector, remove the lab-only settings entry and update affected capability deltas. User evaluation remains deferred.

## 5. Rebuilds without a gap

- [x] 5.1 Report first paint and expose position/start from the native runtime; mount a staged runtime paused at the shown frame with its sound.
- [x] 5.2 Split the host into a window session and per-runtime slots; stage rebuilds hidden, switch to the latest announcement, swap atomically, keep the shown version with a stale notice when staging fails.
- [x] 5.3 Show the loading screen only for the first mount; update the live-preview delta.
- [x] 5.5 Hold a painted slot while the shown one is under a geometry or text edit, or while its objects document lags a write the studio made (`acceptsPreview`), released after 8 s of lag without an edit.
- [ ] 5.4 Verify in the running app: a rebuild during a drag does not interrupt it and the element never returns to an earlier position after drop; an agent edit swaps without a flash while paused and while playing; mute/volume survive; a throwing edit keeps the previous version with the notice; rapid successive writes end on the latest version.

Checked items record implementation only. Runtime behavior and visual parity
are unverified. See app/lab/preview-canvas/README.md for compatibility boundaries.
