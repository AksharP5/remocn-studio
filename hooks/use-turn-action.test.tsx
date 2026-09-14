import { expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { Effect } from "effect";
import { promptAssetOf } from "@/shared/library";
import { SOUND_RESULT } from "@/test/fixtures/sound-result";
import { useTurnAction } from "./use-turn-action";

const input = {
  assets: [promptAssetOf(SOUND_RESULT.asset)],
  prompt: "Use this sound",
};
const turn = {
  isRunning: false,
  openId: "chat-a",
  send: mock(async () => true),
  writesBlocked: null,
};

it("sends a structured asset through the existing turn and prevents duplicate clicks", async () => {
  const pending = Promise.withResolvers<boolean>();
  const send = mock(() => pending.promise);
  const { result } = renderHook(() => useTurnAction({ ...turn, send }, false));
  let sent!: Promise<void>;
  act(() => {
    sent = result.current.run(Effect.succeed(input));
  });
  await act(async () => {
    await result.current.run(Effect.succeed(input));
  });
  expect(send).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledWith(input.prompt, [], [], input.assets);
  await act(async () => {
    pending.resolve(true);
    await sent;
  });
  expect(result.current.state).toBe("sent");
});

it("reports queueing without claiming that the sound was already applied", async () => {
  const { result } = renderHook(() =>
    useTurnAction({ ...turn, isRunning: true }, false)
  );
  await act(async () => {
    await result.current.run(Effect.succeed(input));
  });
  expect(result.current.state).toBe("queued");
});

it("keeps a refused action retryable", async () => {
  const send = mock(async () => false);
  const { result } = renderHook(() => useTurnAction({ ...turn, send }, false));
  await act(async () => {
    await result.current.run(Effect.succeed(input));
  });
  expect(result.current.error).toContain("could not be sent");
  expect(result.current.state).toBe("idle");
  await act(async () => {
    await result.current.run(Effect.succeed(input));
  });
  expect(send).toHaveBeenCalledTimes(2);
});

it("does not send to a different chat after asynchronous preparation", async () => {
  const pending = Promise.withResolvers<typeof input>();
  const send = mock(async () => true);
  const { result, rerender } = renderHook(
    ({ id }) => useTurnAction({ ...turn, openId: id, send }, false),
    { initialProps: { id: "chat-a" } }
  );
  let sent!: Promise<void>;
  act(() => {
    sent = result.current.run(Effect.promise(() => pending.promise));
  });
  rerender({ id: "chat-b" });
  await act(async () => {
    pending.resolve(input);
    await sent;
  });
  expect(send).not.toHaveBeenCalled();
  expect(result.current.error).toContain("chat changed");
});
