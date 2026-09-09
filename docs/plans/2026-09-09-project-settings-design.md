# Project settings (REM-263)

Approved in the task on 2026-09-09. Implement the complete issue, in dependency order.

The portable `.remocn/project.json` manifest owns identity, name, revision and nullable brand. SQLite remains the local path and history index. Writes validate revisions and managed asset containment before atomically replacing the manifest; reopening reconciles the index. Copies with duplicate identities must be explicitly distinguished from relocation.

Settings binds its draft to a project ID. General and Brand save together; location changes separately. Assets are immutable, content-addressed files in the actual Remotion root. Videos retain their own snapshots; new videos capture the current brand and existing videos only change through explicit agent work with previous/target snapshots and observable outcomes.

Every provider receives the snapshot at turn start, including resumed sessions. User instructions outrank snapshot fields. Missing or invalid brand data is reported instead of silently substituted. Imported content remains data, with provenance.

Moving acquires a project mutation lock, stops preview, validates source/destination/git dependencies, journals progress, and switches the local index only after verified file transfer. Cross-volume copies preserve the source until the switch succeeds. Relocation verifies identity and never moves files.

## Implementation and validation

1. Shared schemas, normalization, immutable asset references, snapshot diffs and import contracts.
2. Manifest persistence, revision conflicts, asset staging and crash reconciliation; focused filesystem tests.
3. SQLite projection and identity-aware open/rename/relocate.
4. IPC methods and client operations; mutation coordination and recoverable moves.
5. Project settings UI, pinned drafts, native/project menu entry points and local previews.
6. Video snapshots and provider-neutral turn briefs; explicit rebrand execution and statuses.
7. Pipeline/conventions and font loading; targeted regression tests, typecheck, sidecar/app builds, skills check when applicable, desktop end-to-end scenario.

No global brand library, secret storage, empty integration sections, or new brand-related plan limits.
