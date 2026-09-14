import { describe, expect, it } from "bun:test";
import { Effect, Exit } from "effect";
import type { CoreMethod, CoreResult } from "@/shared/ipc";
import type { SoundOperation } from "@/shared/sound-effects";
import { makeGate } from "../agent/gate";
import { CoreError } from "./core";
import { generateSound, type SoundContext } from "./sounds";

const operation: SoundOperation = {
  account: "Actual account",
  connectionName: "Studio",
  cost: null,
  createdAt: 1,
  detail: null,
  file: null,
  id: "sound_test",
  providerRequestId: null,
  request: {
    connectionId: "cn_1",
    durationSeconds: 2,
    format: "mp3_44100_128",
    name: "Door",
    text: "Door closes",
  },
  state: "prepared",
};

function context(
  decision: "allow" | "deny" | "always",
  commitFails = false,
  music = false
) {
  const gate = makeGate("20 millis");
  const calls: CoreMethod[] = [];
  const cards: unknown[] = [];
  const result: SoundContext = {
    ask: (method) =>
      Effect.suspend(() => {
        calls.push(method);
        if (method === "sounds.commit" && commitFails) {
          return Effect.fail(new CoreError({ message: "The reply was lost." }));
        }
        return Effect.succeed({
          ...operation,
          request: music
            ? {
                ...operation.request,
                durationSeconds: 120,
                forceInstrumental: true,
                kind: "music",
              }
            : operation.request,
          state: method === "sounds.commit" ? "uncertain" : "prepared",
        } as CoreResult<typeof method>);
      }),
    emit: (event) => {
      if (event.type !== "permission") {
        return Effect.void;
      }
      cards.push(event.input);
      return gate.answer(event.id, decision, null).pipe(
        Effect.tap((matched) => Effect.sync(() => expect(matched).toBe(true))),
        Effect.asVoid
      );
    },
    gate,
    turnId: "turn_1",
  };
  return { calls, cards, result };
}

describe("shared paid generation service", () => {
  it("requires approval at the shared execution seam", async () => {
    const test = context("deny");
    expect(
      Exit.isFailure(
        await Effect.runPromiseExit(
          generateSound(operation.request, test.result)
        )
      )
    ).toBe(true);
    expect(test.calls).toEqual(["sounds.prepare", "sounds.cancel"]);
    expect(JSON.stringify(test.cards)).toContain("Actual account");
    expect(JSON.stringify(test.cards)).toContain("spends credits");
  });
  it("never treats an always response as paid authorization", async () => {
    const test = context("always");
    await Effect.runPromiseExit(generateSound(operation.request, test.result));
    expect(test.calls).not.toContain("sounds.commit");
    expect(
      await Effect.runPromise(test.result.gate.remembers("sound:sound_test"))
    ).toBe(false);
  });
  it.each([false, true])(
    "never repeats a commit (lost reply: %s)",
    async (fails) => {
      const test = context("allow", fails);
      await Effect.runPromiseExit(
        generateSound(operation.request, test.result)
      );
      expect(
        test.calls.filter((method) => method === "sounds.commit")
      ).toHaveLength(1);
      expect(test.calls.at(-1)).toBe("sounds.cancel");
    }
  );
  it("aborting a pending card sends no paid request", async () => {
    const test = context("allow");
    const controller = new AbortController();
    test.result.emit = () => Effect.sync(() => controller.abort());
    await Effect.runPromiseExit(generateSound(operation.request, test.result), {
      signal: controller.signal,
    });
    expect(test.calls).not.toContain("sounds.commit");
    expect(test.calls.at(-1)).toBe("sounds.cancel");
  });
  it("a stopped wait after dispatch only cancels waiting, never dispatches twice", async () => {
    const test = context("allow");
    const controller = new AbortController();
    test.result.ask = (method) =>
      Effect.suspend(() => {
        test.calls.push(method);
        if (method === "sounds.commit") {
          controller.abort();
        }
        return Effect.succeed(operation as CoreResult<typeof method>);
      });
    await Effect.runPromiseExit(generateSound(operation.request, test.result), {
      signal: controller.signal,
    });
    expect(
      test.calls.filter((method) => method === "sounds.commit")
    ).toHaveLength(1);
    expect(test.calls.at(-1)).toBe("sounds.cancel");
  });
});

it.each(["deny", "allow"] as const)(
  "requires explicit approval for music: %s",
  async (decision) => {
    const test = context(decision, false, true);
    await Effect.runPromiseExit(
      generateSound(
        {
          ...operation.request,
          durationSeconds: 120,
          forceInstrumental: true,
          format: "mp3_44100_128",
          kind: "music",
        },
        test.result
      )
    );
    expect(
      test.calls.filter((method) => method === "sounds.commit")
    ).toHaveLength(decision === "allow" ? 1 : 0);
    expect(JSON.stringify(test.cards)).toContain("Music · Instrumental");
    expect(JSON.stringify(test.cards)).toContain("120 seconds");
  }
);
