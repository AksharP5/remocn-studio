import { expect, it, mock } from "bun:test";
import { act, fireEvent, renderHook } from "@testing-library/react";
import { useDialCommit } from "./use-dial-commit";

it("commits a pointer gesture once after the final pointerup handler, including portal events", async () => {
  const commit = mock();
  const { result } = renderHook(() => useDialCommit(commit));
  fireEvent.pointerDown(document.body);
  act(() => {
    result.current();
    result.current();
  });
  await act(async () => {
    await Promise.resolve();
  });
  expect(commit).not.toHaveBeenCalled();
  const final = () => result.current();
  document.body.addEventListener("pointerup", final, { once: true });
  fireEvent.pointerUp(document.body);
  await act(async () => {
    await Promise.resolve();
  });
  expect(commit).toHaveBeenCalledTimes(1);
});

it("finishes on cancellation and drops deferred work after switching objects", async () => {
  const commit = mock();
  const { result, unmount } = renderHook(() => useDialCommit(commit));
  fireEvent.pointerDown(document.body);
  act(() => result.current());
  fireEvent.pointerCancel(document.body);
  await act(async () => {
    await Promise.resolve();
  });
  expect(commit).toHaveBeenCalledTimes(1);
  act(() => result.current());
  unmount();
  await act(async () => {
    await Promise.resolve();
  });
  expect(commit).toHaveBeenCalledTimes(1);
});
