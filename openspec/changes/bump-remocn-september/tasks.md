## 1. Vendored set

- [x] 1.1 Move the pin to `8ae853e4c08108105684d4b8cac7f22400840d2a` in `scripts/remocn-sync.ts` and `scripts/remocn-previews.ts`, run `bun run remocn:sync`, and verify `bun run remocn:check` passes
- [x] 1.2 Run `bun run remocn:previews` for the whole set; re-run any failure, and re-run any oversized noise-heavy clip with `--crf`
- [x] 1.3 In `scripts/remocn-previews.ts`, give a component the ANGLE backend when anything in its registry-dependency closure needs WebGL, not only when its own manifest names `@paper-design/shaders-react`

## 2. Sidecar

- [x] 2.1 Classify the forty-one new components in `sidecar/library/roles.ts`; verify with `sidecar/library/roles.test.ts`

## 3. Release

- [x] 3.1 Add a changeset
- [x] 3.2 `bun run check`, `bun run typecheck`, the touched test files, and the full `bun run test` once
- [ ] 3.3 In the running app, the user checks that the components pane shows the new components with their posters and clips, grouped by role
