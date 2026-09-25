"use client";

import { Effect } from "effect";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type CanvasPoint,
  cameraAt,
  cameraCentre,
  easeOutCubic,
  fitPreviewCamera,
  INITIAL_PREVIEW_CAMERA,
  interpolateCamera,
  OCCLUDES_ATTR,
  type Occluder,
  occludedInsets,
  type PreviewCamera,
  panPreviewCamera,
  pixelGrid,
  SELECTION_BOUNDS_ATTR,
  SELECTION_ZOOM,
  screenToCanvas,
  surroundOf,
  zoomPreviewCamera,
} from "@/lib/studio/preview-camera";
import {
  type RememberedCamera,
  readCanvasCamera,
  saveCanvasCamera,
} from "@/lib/studio/settings";

const JUMP_MS = 200;
const SETTLE_MS = 500;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

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

function reducedMotion() {
  return typeof matchMedia === "function" && matchMedia(REDUCED_MOTION).matches;
}

interface ViewActions {
  fit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  zoomToSelection: () => void;
}

function zoomShortcut(
  event: KeyboardEvent,
  actions: ViewActions
): (() => void) | null {
  if (event.key === "0") {
    return actions.zoomReset;
  }
  if (event.key === "=" || event.key === "+") {
    return actions.zoomIn;
  }
  if (event.key === "-") {
    return actions.zoomOut;
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
  const latest = useRef(camera);
  latest.current = camera;
  const tween = useRef<{ frame: number; to: PreviewCamera } | null>(null);
  const moved = useRef(false);
  const pending = useRef<{ camera: RememberedCamera; key: string } | null>(
    null
  );
  const width = size ? size.width : 0;
  const height = size ? size.height : 0;
  const key = identity ? `${identity}:${width}:${height}` : null;

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

  const stopTween = useCallback(() => {
    if (tween.current) {
      cancelAnimationFrame(tween.current.frame);
      tween.current = null;
    }
  }, []);

  const jump = useCallback(
    (next: (base: PreviewCamera) => PreviewCamera) => {
      if (editing()) {
        return;
      }
      const base = tween.current?.to ?? latest.current;
      const target = next(base);
      if (target === base) {
        return;
      }
      stopTween();
      moved.current = true;
      if (reducedMotion()) {
        setCamera(target);
        return;
      }
      const from = latest.current;
      const start = performance.now();
      const step = () => {
        if (editing()) {
          tween.current = null;
          return;
        }
        const progress = (performance.now() - start) / JUMP_MS;
        setCamera(
          interpolateCamera(from, target, easeOutCubic(progress), bounds)
        );
        tween.current =
          progress >= 1
            ? null
            : { frame: requestAnimationFrame(step), to: target };
      };
      tween.current = { frame: requestAnimationFrame(step), to: target };
    },
    [bounds, editing, stopTween]
  );

  useEffect(() => stopTween, [stopTween]);

  const framed = useCallback(
    (view: PreviewCamera) =>
      fitPreviewCamera(
        view,
        { height, width, x: 0, y: 0 },
        bounds,
        insetsOf(viewport.current, FIT_MARGIN)
      ),
    [bounds, height, width]
  );

  const fit = useCallback(() => jump(framed), [framed, jump]);

  const zoomBy = useCallback(
    (factor: number) =>
      jump((view) =>
        zoomPreviewCamera(
          view,
          { x: bounds.width / 2, y: bounds.height / 2 },
          view.zoom * factor
        )
      ),
    [bounds, jump]
  );

  const zoomToSelection = useCallback(() => {
    const node = viewport.current;
    if (!node) {
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
    jump((base) => {
      const shown = latest.current;
      const corner = screenToCanvas(
        { x: box.left - origin.left, y: box.top - origin.top },
        shown
      );
      return fitPreviewCamera(
        base,
        {
          ...corner,
          height: box.height / shown.zoom,
          width: box.width / shown.zoom,
        },
        bounds,
        insetsOf(node, SELECTION_MARGIN),
        SELECTION_ZOOM
      );
    });
  }, [bounds, jump]);

  const toggleOutside = useCallback(
    () => setOutside((value) => (value === "dim" ? "hide" : "dim")),
    []
  );
  const toggleHand = useCallback(() => setHand((value) => !value), []);
  const zoomIn = useCallback(() => zoomBy(ZOOM_STEP), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(1 / ZOOM_STEP), [zoomBy]);
  const zoomReset = useCallback(
    () =>
      jump((view) =>
        zoomPreviewCamera(
          view,
          { x: bounds.width / 2, y: bounds.height / 2 },
          1
        )
      ),
    [bounds, jump]
  );

  const actions = useRef({
    fit,
    togglePlayback,
    zoomIn,
    zoomOut,
    zoomReset,
    zoomToSelection,
  });
  actions.current = {
    fit,
    togglePlayback,
    zoomIn,
    zoomOut,
    zoomReset,
    zoomToSelection,
  };

  const saveNow = useCallback(() => {
    const held = pending.current;
    if (held) {
      pending.current = null;
      Effect.runFork(saveCanvasCamera(held.key, held.camera));
    }
  }, []);

  useEffect(() => {
    if (
      key === null ||
      fitted.current !== key ||
      !moved.current ||
      !bounds.width
    ) {
      return;
    }
    const settled = tween.current?.to ?? camera;
    pending.current = {
      camera: { ...cameraCentre(settled, bounds), zoom: settled.zoom },
      key,
    };
    const timer = setTimeout(saveNow, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [bounds, camera, key, saveNow]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new video writes what the previous one left pending
  useEffect(() => saveNow, [key, saveNow]);

  useEffect(() => {
    if (
      key === null ||
      width <= 0 ||
      height <= 0 ||
      bounds.width <= 64 ||
      bounds.height <= 264
    ) {
      return;
    }
    if (fitted.current === key) {
      return;
    }
    fitted.current = key;
    stopTween();
    moved.current = false;
    const saved = readCanvasCamera(key);
    const restored = saved
      ? cameraAt({ x: saved.x, y: saved.y }, saved.zoom, bounds)
      : null;
    setCamera(restored ?? framed(latest.current));
  }, [bounds, framed, height, key, stopTween, width]);

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
      stopTween();
      moved.current = true;
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
      stopTween();
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
  }, [hand, stopTween]);

  const surround = useMemo(
    () => surroundOf(camera, { height, width }, bounds),
    [bounds, camera, height, width]
  );
  const grid = useMemo(
    () => pixelGrid(camera, { height, width }, bounds),
    [bounds, camera, height, width]
  );

  return {
    bounds,
    camera,
    cursor: navigationCursor(panning, hand, space) ?? "default",
    fit,
    grid,
    hand,
    outside,
    surround,
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
