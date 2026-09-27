## 1. Sidecar

- [x] 1.1 `sidecar/tools/specs.ts`: `generate_sound_effect` takes `connectionId` and `sounds` (1–10 of name, text, duration, format), described as the one call for every sound the person wants. `sidecar/tools/execute.ts` hands `sounds.generate` a list; music passes a list of one. Tests: `sidecar/tools/execute.test.ts`, `sidecar/tools/gateway.test.ts`.
- [x] 1.2 `sidecar/integrations/sounds.ts`: `generateSounds` prepares every sound, raises every ask before waiting, commits the approved ones in order, answers per sound, cancels every prepared sound on exit; a single sound answers as before. `sidecar/handlers.ts` wires it. Test: `sidecar/integrations/sounds.test.ts`.

## 2. Webview

- [x] 2.1 `lib/studio/permission.ts`: `gatheredAsks`, `batchTitle`, `batchChoices` (counted labels, no "always" for outward, approve disabled with nothing checked). Test: `lib/studio/permission.test.ts`.
- [x] 2.2 `hooks/use-open-turn.ts` exposes `asks`; `hooks/use-permission-card.ts` holds the unchecked set and answers every ask of the card. Test: `components/studio/permission-card.test.tsx`.
- [x] 2.3 `components/studio/permission-card.tsx` renders a gathered card as a checkbox list; `chat-pane.tsx` passes `asks`. Test: `components/studio/permission-card.test.tsx`.

## 3. Verification

- [x] 3.1 Changeset `.changeset/asks-raised-together-share-a-card.md`.
- [x] 3.2 `openspec validate asks-raised-together-share-a-card --strict`, `bun run check`, `bun run typecheck`, the touched tests, the full `bun run test`.
- [ ] 3.3 In the running app: ask a chat for three different sound effects — one card lists all three with their descriptions and the charge notice; uncheck one and send — two sounds are generated, the agent says the third was declined. Ask Claude to read three files outside the project at once — one card lists the three paths.
