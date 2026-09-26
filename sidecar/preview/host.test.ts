import { afterEach, describe, expect, it, mock } from "bun:test";
import { Exit } from "effect";
import { decodeHostReply } from "./protocol";

const original = process.stdout.write;

afterEach(() => {
  process.stdout.write = original;
});

describe("design progress", () => {
  it("travels as a frame after stdout is handed to the log", async () => {
    const wire = mock((_chunk: string) => true);
    process.stdout.write = wire as unknown as typeof process.stdout.write;

    const { designProgress } = await import("./host");

    const redirected = mock((_chunk: string) => true);
    process.stdout.write = redirected as unknown as typeof process.stdout.write;

    designProgress("request-1")("frames", 3, 12);

    expect(redirected).not.toHaveBeenCalled();
    expect(wire).toHaveBeenCalledTimes(1);

    const line = String(wire.mock.calls[0]?.[0]);
    const decoded = decodeHostReply(line.trim());

    expect(line.endsWith("\n")).toBe(true);
    expect(Exit.isSuccess(decoded)).toBe(true);
    expect(Exit.isSuccess(decoded) ? decoded.value : null).toEqual({
      completed: 3,
      id: "request-1",
      stage: "frames",
      total: 12,
      type: "design-progress",
    });
  });
});
