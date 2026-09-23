## 1. Sidecar

- [x] 1.1 Add `recovering(state)` to `sidecar/preview/build-state.ts`; verify `build-state.test.ts` covers building, ok, failed and failed-then-started
- [x] 1.2 In `sidecar/preview/host.ts`, read the previous build state as the successful compile settles and send `ready` again when it heals a failure, after the rebuild notification

## 2. Webview

- [x] 2.1 Add the served → failed → building → ready sequence to `hooks/use-preview.test.tsx` and assert the pane plays again

## 3. Wrap up

- [x] 3.1 `bun run check`, `bun run typecheck`, changeset
- [x] 3.2 In the running app: break a file the bundle includes, watch the pane show the error, fix it, and watch the player come back without Restart
