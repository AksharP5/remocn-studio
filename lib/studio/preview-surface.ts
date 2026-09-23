import type { PreviewCommand } from "./preview";

export interface PreviewSurface {
  send: (command: PreviewCommand) => void;
  subscribe: (receive: (message: unknown) => void) => () => void;
  focus: () => void;
  dispose: () => void;
}

export function createPreviewSurfaceChannel() {
  const listeners = new Set<(message: unknown) => void>();
  let current: { surface: PreviewSurface; disconnect: () => void } | null = null;

  const attach = (surface: PreviewSurface) => {
    current?.disconnect();
    let unsubscribe = () => {};
    let connected = true;
    const connection = {
      surface,
      disconnect: () => {
        if (!connected) return;
        connected = false;
        if (current === connection) current = null;
        try {
          unsubscribe();
        } finally {
          surface.dispose();
        }
      },
    };
    current = connection;
    try {
      unsubscribe = surface.subscribe((message) => {
        if (!connected || current !== connection) return;
        for (const receive of [...listeners]) receive(message);
      });
      if (!connected) unsubscribe();
    } catch (error) {
      connection.disconnect();
      throw error;
    }
    return connection.disconnect;
  };

  return {
    attach,
    focus: () => current?.surface.focus(),
    send: (command: PreviewCommand) => current?.surface.send(command),
    subscribe: (receive: (message: unknown) => void) => {
      listeners.add(receive);
      return () => {
        listeners.delete(receive);
      };
    },
    disconnect: () => current?.disconnect(),
  };
}

export function iframePreviewSurface(
  frame: () => HTMLIFrameElement | null,
  origin: string
): PreviewSurface {
  const subscriptions = new Set<() => void>();
  let disposed = false;
  return {
    send: (command) => {
      if (!disposed) frame()?.contentWindow?.postMessage(command, origin);
    },
    subscribe: (receive) => {
      if (disposed) return () => {};
      const listener = (event: MessageEvent) => {
        if (
          !disposed &&
          event.origin === origin &&
          event.source === frame()?.contentWindow
        ) {
          receive(event.data);
        }
      };
      const stop = () => {
        window.removeEventListener("message", listener);
        subscriptions.delete(stop);
      };
      subscriptions.add(stop);
      window.addEventListener("message", listener);
      return stop;
    },
    focus: () => {
      if (!disposed) frame()?.focus();
    },
    dispose: () => {
      disposed = true;
      for (const stop of [...subscriptions]) stop();
    },
  };
}
