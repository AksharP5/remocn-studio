import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import type { AgentEvent } from "@/shared/ipc";
import { coalescing } from "./coalesce";

const run = <A>(effect: Effect.Effect<A>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestClock.layer())));

function collector() {
  const sent: AgentEvent[] = [];
  return {
    emit: (event: AgentEvent) =>
      Effect.sync(() => {
        sent.push(event);
      }),
    sent,
  };
}

const text = (value: string): AgentEvent => ({ text: value, type: "text" });
const thinking = (value: string): AgentEvent => ({
  text: value,
  type: "thinking",
});

describe("coalescing", () => {
  it("sends a burst of text as one frame once the window has passed", async () => {
    const out = collector();

    const before = await run(
      Effect.gen(function* () {
        const stream = yield* coalescing(out.emit, "24 millis");
        yield* stream.emit(text("Wri"));
        yield* stream.emit(text("ting "));
        yield* stream.emit(text("it."));
        const early = out.sent.length;
        yield* TestClock.adjust("30 millis");
        return early;
      })
    );

    expect(before).toBe(0);
    expect(out.sent).toEqual([text("Writing it.")]);
  });

  it("never lets text overtake what came after it, and keeps kinds apart", async () => {
    const out = collector();
    const tool: AgentEvent = {
      id: "toolu_1",
      input: {},
      name: "Write",
      type: "tool_use",
      verb: "create",
    };

    await run(
      Effect.gen(function* () {
        const stream = yield* coalescing(out.emit, "24 millis");
        yield* stream.emit(thinking("Plan"));
        yield* stream.emit(thinking(" it"));
        yield* stream.emit(text("Doing"));
        yield* stream.emit(text(" it"));
        yield* stream.emit(tool);
        yield* stream.emit(text("Done"));
        yield* stream.flush;
      })
    );

    expect(out.sent).toEqual([
      thinking("Plan it"),
      text("Doing it"),
      tool,
      text("Done"),
    ]);
  });

  it("gives up nothing it holds when the turn is flushed", async () => {
    const out = collector();

    await run(
      Effect.gen(function* () {
        const stream = yield* coalescing(out.emit, "24 millis");
        yield* stream.emit(text("last words"));
        yield* stream.flush;
        yield* TestClock.adjust("1 second");
      })
    );

    expect(out.sent).toEqual([text("last words")]);
  });
});
