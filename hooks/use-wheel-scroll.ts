"use client";

import { useEffect, useRef } from "react";
import { wheelDelta, wheelScroll } from "@/lib/studio/scroll";

/**
 * Turns a wheel into horizontal travel on a strip that only scrolls sideways.
 *
 * The listener is attached by hand rather than through `onWheel`, because it
 * has to be non-passive: taking the gesture means calling `preventDefault`,
 * and React gives no way to say that. It is only taken when the strip can
 * actually move — see `wheelScroll`.
 */
export function useWheelScroll<T extends HTMLElement>(): {
  ref: React.RefObject<T | null>;
} {
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;

    if (node === null) {
      return;
    }

    const onWheel = (event: WheelEvent) => {
      const next = wheelScroll(node, wheelDelta(event));

      if (next !== null) {
        event.preventDefault();
        node.scrollLeft = next;
      }
    };

    node.addEventListener("wheel", onWheel, { passive: false });

    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  return { ref };
}
