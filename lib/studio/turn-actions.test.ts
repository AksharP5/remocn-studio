import { expect, it } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { Effect, Exit } from "effect";
import { SOUND_RESULT } from "@/test/fixtures/sound-result";
import { causeMessage } from "../error-message";
import { prepareSoundUse, regenerateSoundPrompt } from "./turn-actions";

it("resolves the current library asset instead of reusing a stale card metadata", async () => {
  const current = {
    ...SOUND_RESULT.asset,
    name: "Renamed sound",
    path: "/new-library/door",
    slug: "renamed-door",
  };
  mockIPC(() => [current]);
  const action = await Effect.runPromise(prepareSoundUse(SOUND_RESULT));
  expect(action.assets[0].slug).toBe(current.slug);
  expect(action.assets[0].name).toBe(current.name);
});

it("refuses a sound deleted from the library without a turn submission", async () => {
  mockIPC(() => []);
  const exit = await Effect.runPromiseExit(prepareSoundUse(SOUND_RESULT));
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isFailure(exit)) {
    expect(causeMessage(exit.cause)).toContain("no longer in the library");
  }
});

it("preserves music intent and vocals when reusing or regenerating", async () => {
  const result = {
    ...SOUND_RESULT,
    request: {
      ...SOUND_RESULT.request,
      durationSeconds: 120,
      forceInstrumental: true,
      format: "mp3_44100_128" as const,
      kind: "music" as const,
    },
  };
  mockIPC(() => [result.asset]);
  expect((await Effect.runPromise(prepareSoundUse(result))).prompt).toContain(
    "as music"
  );
  const prompt = regenerateSoundPrompt(result);
  expect(prompt).toContain("version of the music");
  expect(prompt).toContain("Instrumental only: yes");
});
