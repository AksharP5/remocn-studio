import { afterEach, describe, expect, it } from "bun:test";
import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";
import { Effect, Exit } from "effect";
import { causeMessage } from "@/lib/error-message";
import type { CoreRequestFrame, SidecarFrame } from "@/shared/ipc";
import { make, SidecarChannel } from "@/sidecar/channel";
import {
  askCore,
  forgetPending,
  settleCoreResult,
} from "@/sidecar/integrations/core";

function harness() {
  const input = new PassThrough();
  const sent: SidecarFrame[] = [];

  let announce: (frame: CoreRequestFrame) => void = () => undefined;
  const asked = new Promise<CoreRequestFrame>((resolve) => {
    announce = resolve;
  });

  const channel = make({
    input: createInterface({ crlfDelay: Number.POSITIVE_INFINITY, input }),
    stderr: () => undefined,
    stdout: (line) => {
      const frame = JSON.parse(line) as SidecarFrame;
      sent.push(frame);
      if (frame.type === "request") {
        announce(frame);
      }
    },
  });

  const ask = () =>
    Effect.runPromiseExit(
      askCore("integrations.usable", null).pipe(
        Effect.provideService(SidecarChannel, channel)
      )
    );

  return { ask, asked, sent };
}

const connection = {
  account: "studio@remocn.dev",
  capabilities: ["audio"],
  detail: null,
  disabled: false,
  id: "cn_1",
  name: "My ElevenLabs",
  provider: "elevenlabs",
  state: "connected",
};

afterEach(() => {
  forgetPending();
});

describe("asking the core across the reverse channel", () => {
  it("sends a request naming the method", async () => {
    const { ask, asked } = harness();
    const running = ask();
    const frame = await asked;

    expect(frame.method).toBe("integrations.usable");
    expect(frame.params).toBeNull();

    await Effect.runPromise(
      settleCoreResult({
        data: [],
        id: frame.id,
        type: "result",
      })
    );
    await running;
  });

  it("answers with the connections the core sent", async () => {
    const { ask, asked } = harness();
    const running = ask();
    const frame = await asked;

    await Effect.runPromise(
      settleCoreResult({
        data: [connection],
        id: frame.id,
        type: "result",
      })
    );

    const exit = await running;

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toHaveLength(1);
      expect(exit.value[0]?.name).toBe("My ElevenLabs");
    }
  });

  it("fails with the core's own sentence", async () => {
    const { ask, asked } = harness();
    const running = ask();
    const frame = await asked;

    await Effect.runPromise(
      settleCoreResult({
        id: frame.id,
        message: "The keychain refused, so your connections could not be read.",
        type: "error",
      })
    );

    const exit = await running;

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(causeMessage(exit.cause)).toBe(
        "The keychain refused, so your connections could not be read."
      );
    }
  });

  it("fails with a sentence when the core answers in a shape it cannot read", async () => {
    const { ask, asked } = harness();
    const running = ask();
    const frame = await asked;

    await Effect.runPromise(
      settleCoreResult({
        data: [{ ...connection, state: "probably-fine" }],
        id: frame.id,
        type: "result",
      })
    );

    const exit = await running;

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("ignores an answer to a request it is not waiting for", async () => {
    const settled = await Effect.runPromise(
      settleCoreResult({
        data: [],
        id: "core-does-not-exist",
        type: "result",
      })
    );

    expect(settled).toBe(false);
  });
});

describe("a core that never answers", () => {
  it("fails with a sentence rather than holding the caller", async () => {
    const input = new PassThrough();
    const channel = make({
      input: createInterface({ crlfDelay: Number.POSITIVE_INFINITY, input }),
      stderr: () => undefined,
      stdout: () => undefined,
    });

    const exit = await Effect.runPromiseExit(
      askCore("integrations.usable", null, "20 millis").pipe(
        Effect.provideService(SidecarChannel, channel)
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(causeMessage(exit.cause)).toBe(
        "The studio did not answer in time, so this could not be checked."
      );
    }
  });
});
