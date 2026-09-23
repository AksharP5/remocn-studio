import { onCommand, post } from "./bridge";

const subscriptions = new Map<(event: MessageEvent) => void, () => void>();
export const managedTransport = {
  addEventListener(_type: "message", receive: (event: MessageEvent) => void) {
    subscriptions.get(receive)?.();
    subscriptions.set(
      receive,
      onCommand((command) =>
        receive(
          new MessageEvent("message", {
            data: { ...command, source: "remocn-studio" },
            source: window.parent,
          })
        )
      )
    );
  },
  postMessage(message: Record<string, unknown>, _origin: string) {
    post(message);
  },
  removeEventListener(
    _type: "message",
    receive: (event: MessageEvent) => void
  ) {
    subscriptions.get(receive)?.();
    subscriptions.delete(receive);
  },
};
