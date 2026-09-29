"use client";

import {
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";

const OPEN_DELAY_MS = 80;
const CLOSE_DELAY_MS = 200;
const LEFT_EDGE = 8;

export interface SidebarPeek {
  onEdgeEnter: () => void;
  onEdgeLeave: () => void;
  onPanelEnter: () => void;
  onPanelLeave: (event: PointerEvent<HTMLElement>) => void;
  onPanelPointerDown: () => void;
}

export function useSidebarPeek(
  isPeeking: boolean,
  peek: (isOpen: boolean) => void
): SidebarPeek {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInside = useRef(false);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const later = useCallback(
    (isOpen: boolean, delay: number) => {
      clear();
      timer.current = setTimeout(() => {
        timer.current = null;
        peek(isOpen);
      }, delay);
    },
    [clear, peek]
  );

  useEffect(() => clear, [clear]);

  useEffect(() => {
    if (!isPeeking) {
      return;
    }

    const down = () => {
      if (!isInside.current) {
        clear();
        peek(false);
      }
      isInside.current = false;
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        clear();
        peek(false);
      }
    };

    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", keydown);
    };
  }, [clear, isPeeking, peek]);

  const onEdgeEnter = useCallback(() => later(true, OPEN_DELAY_MS), [later]);

  const onPanelLeave = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.clientX > LEFT_EDGE) {
        later(false, CLOSE_DELAY_MS);
      }
    },
    [later]
  );

  const onPanelPointerDown = useCallback(() => {
    isInside.current = true;
  }, []);

  return useMemo(
    () => ({
      onEdgeEnter,
      onEdgeLeave: clear,
      onPanelEnter: clear,
      onPanelLeave,
      onPanelPointerDown,
    }),
    [clear, onEdgeEnter, onPanelLeave, onPanelPointerDown]
  );
}
