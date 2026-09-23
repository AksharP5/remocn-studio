"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  type CanvasPoint,
  fitPreviewCamera,
  INITIAL_PREVIEW_CAMERA,
  OCCLUDES_ATTR,
  type Occluder,
  occludedInsets,
  type PreviewCamera,
  panPreviewCamera,
  SELECTION_BOUNDS_ATTR,
  SELECTION_ZOOM,
  screenToCanvas,
  zoomPreviewCamera,
} from "@/lib/studio/preview-camera";

const savedCameras = new Map<string, PreviewCamera>();

const INTERACTIVE =
  "button,input,textarea,select,a,[contenteditable],[data-canvas-chrome]";
const ZOOM_STEP = 1.2;
const FIT_MARGIN = 24;
const SELECTION_MARGIN = 72;

function insetsOf(node: HTMLElement | null, margin: number) {
  if (node === null) {
    return occludedInsets({ bottom: 0, left: 0, right: 0, top: 0 }, [], margin);
  }
  const occluders: Occluder[] = [
    ...node.querySelectorAll<HTMLElement>(`[${OCCLUDES_ATTR}]`),
  ].map((element) => ({
    rect: element.getBoundingClientRect(),
    side: element.getAttribute(OCCLUDES_ATTR) as Occluder["side"],
  }));
  return occludedInsets(node.getBoundingClientRect(), occluders, margin);
}

function navigationCursor(panning: boolean, hand: boolean, space: boolean) {
  if (panning) {
    return "grabbing";
  }
  if (hand || space) {
    return "grab";
  }
  return null;
}

function wheelFactor(event: WheelEvent, node: HTMLElement) {
  if (event.deltaMode === 1) {
    return 16;
  }
  if (event.deltaMode === 2) {
    return node.clientHeight;
  }
  return 1;
}

interface ViewActions {
  fit: () => void;
  zoom: number;
  zoomTo: (zoom: number) => void;
  zoomToSelection: () => void;
}

function zoomShortcut(
  event: KeyboardEvent,
  { zoom, zoomTo }: ViewActions
): (() => void) | null {
  if (event.key === "0") {
    return () => zoomTo(1);
  }
  if (event.key === "=" || event.key === "+") {
    return () => zoomTo(zoom * ZOOM_STEP);
  }
  if (event.key === "-") {
    return () => zoomTo(zoom / ZOOM_STEP);
  }
  return null;
}

function viewShortcut(
  event: KeyboardEvent,
  actions: ViewActions
): (() => void) | null {
  if ((event.metaKey || event.ctrlKey) && !event.altKey) {
    return zoomShortcut(event, actions);
  }
  if (event.altKey || !event.shiftKey) {
    return null;
  }
  if (event.code === "Digit1") {
    return actions.fit;
  }
  if (event.code === "Digit2") {
    return actions.zoomToSelection;
  }
  return null;
}

export type OutsideFrame = "dim" | "hide";

export function usePreviewCamera(
  size: { width: number; height: number } | null,
  identity: string | null,
  togglePlayback: () => void
) {
  const viewport = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState(INITIAL_PREVIEW_CAMERA);
  const [hand, setHand] = useState(false);
  const [panning, setPanning] = useState(false);
  const [space, setSpace] = useState(false);
  const [outside, setOutside] = useState<OutsideFrame>("dim");
  const [bounds, setBounds] = useState({ height: 0, width: 0 });
  const spaceHeld = useRef(false);
  const fitted = useRef<string | null>(null);
  const drag = useRef<{ id: number; point: CanvasPoint } | null>(null);
  const width = size ? size.width : 0;
  const height = size ? size.height : 0;

  useEffect(() => {
    const node = viewport.current;
    if (!node) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setBounds({
          height: entry.contentRect.height,
          width: entry.contentRect.width,
        });
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const editing = useCallback(
    () => viewport.current?.hasAttribute("data-preview-editing") ?? false,
    []
  );

  const fit = useCallback(() => {
    if (editing()) {
      return;
    }
    setCamera((current) =>
      fitPreviewCamera(
        current,
        { height, width, x: 0, y: 0 },
        bounds,
        insetsOf(viewport.current, FIT_MARGIN)
      )
    );
  }, [bounds, editing, height, width]);

  const zoomTo = useCallback(
    (zoom: number) => {
      if (editing()) {
        return;
      }
      setCamera((current) =>
        zoomPreviewCamera(
          current,
          {
            x: bounds.width / 2,
            y: bounds.height / 2,
          },
          zoom
        )
      );
    },
    [bounds, editing]
  );

  const zoomToSelection = useCallback(() => {
    const node = viewport.current;
    if (!node || editing()) {
      return;
    }
    const origin = node.getBoundingClientRect();
    const box = [
      ...node.querySelectorAll<HTMLElement>(`[${SELECTION_BOUNDS_ATTR}]`),
    ]
      .map((element) => element.getBoundingClientRect())
      .find((rect) => rect.width > 0 && rect.height > 0);
    if (!box) {
      return;
    }
    setCamera((current) => {
      const corner = screenToCanvas(
        { x: box.left - origin.left, y: box.top - origin.top },
        current
      );
      return fitPreviewCamera(
        current,
        {
          ...corner,
          height: box.height / current.zoom,
          width: box.width / current.zoom,
        },
        bounds,
        insetsOf(node, SELECTION_MARGIN),
        SELECTION_ZOOM
      );
    });
  }, [bounds, editing]);

  const toggleOutside = useCallback(
    () => setOutside((value) => (value === "dim" ? "hide" : "dim")),
    []
  );
  const toggleHand = useCallback(() => setHand((value) => !value), []);
  const zoomIn = useCallback(
    () => zoomTo(camera.zoom * ZOOM_STEP),
    [camera.zoom, zoomTo]
  );
  const zoomOut = useCallback(
    () => zoomTo(camera.zoom / ZOOM_STEP),
    [camera.zoom, zoomTo]
  );
  const zoomReset = useCallback(() => zoomTo(1), [zoomTo]);

  const actions = useRef({
    fit,
    togglePlayback,
    zoom: camera.zoom,
    zoomTo,
    zoomToSelection,
  });
  actions.current = {
    fit,
    togglePlayback,
    zoom: camera.zoom,
    zoomTo,
    zoomToSelection,
  };

  useEffect(() => {
    if (
      !identity ||
      width <= 0 ||
      height <= 0 ||
      bounds.width <= 64 ||
      bounds.height <= 264
    ) {
      return;
    }
    const key = `${identity}:${width}:${height}`;
    if (fitted.current === key) {
      return;
    }
    fitted.current = key;
    const saved = savedCameras.get(key);
    if (saved) {
      setCamera(saved);
    } else {
      fit();
    }
  }, [bounds, fit, height, identity, width]);

  useLayoutEffect(() => {
    const node = viewport.current;
    const cursor = navigationCursor(panning, hand, space);
    if (cursor) {
      node?.style.setProperty("--remocn-canvas-cursor", cursor);
    } else {
      node?.style.removeProperty("--remocn-canvas-cursor");
    }
    node?.toggleAttribute("data-preview-navigation", cursor !== null);
  }, [hand, panning, space]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the event announces every camera and bounds change, so they are its trigger
  useLayoutEffect(() => {
    viewport.current?.dispatchEvent(new Event("preview-view-change"));
  }, [camera, bounds]);

  useEffect(() => {
    const key = `${identity}:${width}:${height}`;
    return () => {
      if (identity && fitted.current === key) {
        savedCameras.set(key, camera);
        if (savedCameras.size > 50) {
          const oldest = savedCameras.keys().next();
          if (!oldest.done) {
            savedCameras.delete(oldest.value);
          }
        }
      }
    };
  }, [camera, height, identity, width]);

  useEffect(() => {
    const node = viewport.current;
    if (!node) {
      return;
    }
    const capture = node.parentElement ?? node;
    let queued: ((view: PreviewCamera) => PreviewCamera)[] = [];
    let scheduled = 0;
    const flush = () => {
      scheduled = 0;
      const steps = queued;
      queued = [];
      if (steps.length > 0) {
        setCamera((current) =>
          steps.reduce((view, step) => step(view), current)
        );
      }
    };
    const schedule = (step: (view: PreviewCamera) => PreviewCamera) => {
      queued.push(step);
      if (scheduled === 0) {
        scheduled = requestAnimationFrame(flush);
      }
    };
    const isControl = (event: Event) =>
      event
        .composedPath()
        .some(
          (item) =>
            item instanceof Element &&
            item.getRootNode() === document &&
            item.matches(INTERACTIVE)
        );
    const point = (event: { clientX: number; clientY: number }) => {
      const rect = node.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const wheel = (event: WheelEvent) => {
      if (isControl(event)) {
        return;
      }
      event.preventDefault();
      if (node.hasAttribute("data-preview-editing")) {
        return;
      }
      const factor = wheelFactor(event, node);
      if (event.ctrlKey || event.metaKey) {
        const delta = Math.max(-50, Math.min(50, event.deltaY * factor));
        const anchor = point(event);
        schedule((current) =>
          zoomPreviewCamera(
            current,
            anchor,
            current.zoom * Math.exp(-delta * 0.01)
          )
        );
      } else {
        const delta = {
          x: -event.deltaX * factor,
          y: -event.deltaY * factor,
        };
        schedule((current) => panPreviewCamera(current, delta));
      }
    };
    const overSelection = (event: PointerEvent) =>
      [
        ...node.querySelectorAll<HTMLElement>(`[${SELECTION_BOUNDS_ATTR}]`),
      ].some((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.width > 0 &&
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        );
      });
    const down = (event: PointerEvent) => {
      if (
        node.hasAttribute("data-preview-editing") ||
        isControl(event) ||
        (event.button !== 0 && event.button !== 1)
      ) {
        return;
      }
      node.focus({ preventScroll: true });
      const background = event.target === node && !overSelection(event);
      if (
        !(
          hand ||
          spaceHeld.current ||
          event.button === 1 ||
          background ||
          event.pointerType === "touch"
        )
      ) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      drag.current = { id: event.pointerId, point: point(event) };
      node.setPointerCapture(event.pointerId);
      setPanning(true);
    };
    const move = (event: PointerEvent) => {
      const { current } = drag;
      if (!current || current.id !== event.pointerId) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const next = point(event);
      const delta = {
        x: next.x - current.point.x,
        y: next.y - current.point.y,
      };
      schedule((previous) => panPreviewCamera(previous, delta));
      current.point = next;
    };
    const end = (event?: Event) => {
      if (drag.current && event) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      const { current } = drag;
      drag.current = null;
      setPanning(false);
      if (current && node.hasPointerCapture(current.id)) {
        node.releasePointerCapture(current.id);
      }
    };
    const reset = () => {
      spaceHeld.current = false;
      setSpace(false);
      end();
    };
    const typing = (event: Event) =>
      event
        .composedPath()
        .some(
          (item) =>
            item instanceof Element &&
            item.getRootNode() === document &&
            item.matches(INTERACTIVE) &&
            !item.hasAttribute("data-geometry-handle")
        );
    const keydown = (event: KeyboardEvent) => {
      if (
        node.hasAttribute("data-preview-editing") ||
        typing(event) ||
        event.isComposing
      ) {
        return;
      }
      const view = viewShortcut(event, actions.current);
      if (view) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!(event.repeat && event.shiftKey)) {
          view();
        }
        return;
      }
      navigationKey(event);
    };
    const navigationKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        event.stopImmediatePropagation();
        spaceHeld.current = true;
        setSpace(true);
      } else if (event.key.toLowerCase() === "k" && !event.repeat) {
        event.preventDefault();
        actions.current.togglePlayback();
      }
    };
    const keyup = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        spaceHeld.current = false;
        setSpace(false);
      }
    };
    node.addEventListener("wheel", wheel, { passive: false });
    capture.addEventListener("pointerdown", down, true);
    capture.addEventListener("pointermove", move, true);
    capture.addEventListener("pointerup", end, true);
    capture.addEventListener("pointercancel", end, true);
    node.addEventListener("lostpointercapture", end);
    capture.addEventListener("keydown", keydown, true);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", reset);
    return () => {
      reset();
      cancelAnimationFrame(scheduled);
      flush();
      node.removeEventListener("wheel", wheel);
      capture.removeEventListener("pointerdown", down, true);
      capture.removeEventListener("pointermove", move, true);
      capture.removeEventListener("pointerup", end, true);
      capture.removeEventListener("pointercancel", end, true);
      node.removeEventListener("lostpointercapture", end);
      capture.removeEventListener("keydown", keydown, true);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", reset);
    };
  }, [hand]);

  return {
    bounds,
    camera,
    cursor: navigationCursor(panning, hand, space) ?? "default",
    fit,
    frame: {
      height: height * camera.zoom,
      left: camera.x,
      top: camera.y,
      width: width * camera.zoom,
    },
    hand,
    outside,
    toggleHand,
    toggleOutside,
    transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
    viewport,
    zoomIn,
    zoomOut,
    zoomReset,
    zoomToSelection,
  };
}
