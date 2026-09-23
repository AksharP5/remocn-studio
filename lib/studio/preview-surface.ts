import type { PreviewCommand } from "./preview";

export interface PreviewSurface {
  dispose: () => void;
  focus: () => void;
  send: (command: PreviewCommand) => void;
  subscribe: (receive: (message: unknown) => void) => () => void;
}

export function createPreviewSurfaceChannel() {
  const listeners = new Set<(message: unknown) => void>();
  let current: { surface: PreviewSurface; disconnect: () => void } | null =
    null;

  const attach = (surface: PreviewSurface) => {
    current?.disconnect();
    let unsubscribe: () => void = () => undefined;
    let connected = true;
    const connection = {
      disconnect: () => {
        if (!connected) {
          return;
        }
        connected = false;
        if (current === connection) {
          current = null;
        }
        try {
          unsubscribe();
        } finally {
          surface.dispose();
        }
      },
      surface,
    };
    current = connection;
    try {
      unsubscribe = surface.subscribe((message) => {
        if (!connected || current !== connection) {
          return;
        }
        for (const receive of [...listeners]) {
          receive(message);
        }
      });
      if (!connected) {
        unsubscribe();
      }
    } catch (error) {
      connection.disconnect();
      throw error;
    }
    return connection.disconnect;
  };

  return {
    attach,
    disconnect: () => current?.disconnect(),
    focus: () => current?.surface.focus(),
    send: (command: PreviewCommand) => current?.surface.send(command),
    subscribe: (receive: (message: unknown) => void) => {
      listeners.add(receive);
      return () => {
        listeners.delete(receive);
      };
    },
  };
}
