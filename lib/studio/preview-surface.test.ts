import { describe, expect, it, mock } from "bun:test";
import { pauseCommand } from "./preview";
import {
  createPreviewSurfaceChannel,
  type PreviewSurface,
} from "./preview-surface";

function fakeSurface(): PreviewSurface & {
  emit: (message: unknown) => void;
} {
  const listeners = new Set<(message: unknown) => void>();
  return {
    dispose: mock(),
    emit: (message) => {
      for (const listen of listeners) {
        listen(message);
      }
    },
    focus: mock(),
    send: mock(),
    subscribe: mock((receive: (message: unknown) => void) => {
      listeners.add(receive);
      return () => {
        listeners.delete(receive);
      };
    }),
  };
}

describe("createPreviewSurfaceChannel", () => {
  it("delivers messages from the attached surface to its listeners", () => {
    const channel = createPreviewSurfaceChannel();
    const surface = fakeSurface();
    const receive = mock();
    channel.attach(surface);
    channel.subscribe(receive);

    surface.emit({ type: "selection" });

    expect(receive).toHaveBeenCalledWith({ type: "selection" });
  });

  it("forwards send and focus to the current surface only", () => {
    const channel = createPreviewSurfaceChannel();
    const surface = fakeSurface();
    channel.attach(surface);

    channel.send(pauseCommand());
    channel.focus();

    expect(surface.send).toHaveBeenCalledWith(pauseCommand());
    expect(surface.focus).toHaveBeenCalledTimes(1);
  });

  it("disposes and unsubscribes a surface once a new one is attached", () => {
    const channel = createPreviewSurfaceChannel();
    const first = fakeSurface();
    const second = fakeSurface();
    channel.attach(first);

    channel.attach(second);

    expect(first.dispose).toHaveBeenCalledTimes(1);
    channel.send(pauseCommand());
    expect(first.send).not.toHaveBeenCalled();
    expect(second.send).toHaveBeenCalledTimes(1);
  });

  it("ignores a message from a surface that has since been replaced", () => {
    const channel = createPreviewSurfaceChannel();
    const first = fakeSurface();
    const second = fakeSurface();
    const receive = mock();
    channel.attach(first);
    channel.subscribe(receive);
    channel.attach(second);

    first.emit({ type: "selection" });

    expect(receive).not.toHaveBeenCalled();
  });

  it("stops delivering once the surface disconnects, without a replacement", () => {
    const channel = createPreviewSurfaceChannel();
    const surface = fakeSurface();
    const receive = mock();
    channel.attach(surface);
    channel.subscribe(receive);

    channel.disconnect();
    surface.emit({ type: "selection" });

    expect(receive).not.toHaveBeenCalled();
    expect(surface.dispose).toHaveBeenCalledTimes(1);
  });

  it("drops a command once the surface has disconnected", () => {
    const channel = createPreviewSurfaceChannel();
    const surface = fakeSurface();
    channel.attach(surface);

    channel.disconnect();
    channel.send(pauseCommand());
    channel.focus();

    expect(surface.send).not.toHaveBeenCalled();
    expect(surface.focus).not.toHaveBeenCalled();
  });

  it("does nothing when a command is sent before any surface attaches", () => {
    const channel = createPreviewSurfaceChannel();

    expect(() => {
      channel.send(pauseCommand());
      channel.focus();
      channel.disconnect();
    }).not.toThrow();
  });

  it("disposes a surface exactly once even if the attach's own detach runs after a replacement", () => {
    const channel = createPreviewSurfaceChannel();
    const first = fakeSurface();
    const detachFirst = channel.attach(first);
    channel.attach(fakeSurface());

    detachFirst();

    expect(first.dispose).toHaveBeenCalledTimes(1);
  });

  it("keeps a second listener once the first unsubscribes", () => {
    const channel = createPreviewSurfaceChannel();
    const surface = fakeSurface();
    const first = mock();
    const second = mock();
    channel.attach(surface);
    const unsubscribeFirst = channel.subscribe(first);
    channel.subscribe(second);
    unsubscribeFirst();

    surface.emit({ type: "selection" });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({ type: "selection" });
  });
});
