import { onCommand, post } from "./bridge";

const subscriptions = new Map<(event: MessageEvent) => void, () => void>();
export const managedTransport = {
  postMessage(message: Record<string, unknown>, _origin: string) { post(message); },
  addEventListener(_type: "message", receive: (event: MessageEvent) => void) {
    subscriptions.get(receive)?.();
    subscriptions.set(receive, onCommand((command) => receive(new MessageEvent("message", {
      data: { ...command, source: "remocn-studio" }, source: window.parent,
    }))));
  },
  removeEventListener(_type: "message", receive: (event: MessageEvent) => void) {
    subscriptions.get(receive)?.();
    subscriptions.delete(receive);
  },
};
