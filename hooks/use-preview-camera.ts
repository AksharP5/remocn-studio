"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  canvasInsets,
  fitPreviewCamera,
  INITIAL_PREVIEW_CAMERA,
  panPreviewCamera,
  SELECTION_BOUNDS_ATTR,
  SELECTION_ZOOM,
  screenToCanvas,
  zoomPreviewCamera,
  type CanvasPoint,
  type PreviewCamera,
} from "@/lib/studio/preview-camera";

const savedCameras = new Map<string, PreviewCamera>();

const INTERACTIVE = "button,input,textarea,select,a,[contenteditable],[data-canvas-chrome]";
const ZOOM_STEP = 1.2;
const SELECTION_MARGIN = 48;

export type OutsideFrame = "dim" | "hide";

export function usePreviewCamera(
  size: { width: number; height: number } | null,
  identity: string | null,
  inspector: boolean,
  togglePlayback: () => void
) {
  const viewport = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState(INITIAL_PREVIEW_CAMERA);
  const [hand, setHand] = useState(false);
  const [panning, setPanning] = useState(false);
  const [space, setSpace] = useState(false);
  const [outside, setOutside] = useState<OutsideFrame>("dim");
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const spaceHeld = useRef(false);
  const fitted = useRef<string | null>(null);
  const drag = useRef<{ id: number; point: CanvasPoint } | null>(null);
  const width = size?.width ?? 0;
  const height = size?.height ?? 0;

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setBounds({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const editing = useCallback(() => viewport.current?.hasAttribute("data-preview-editing") ?? false, []);

  const fit = useCallback(() => {
    if (editing()) return;
    setCamera((current) => fitPreviewCamera(current, { x: 0, y: 0, width, height }, bounds, canvasInsets(inspector)));
  }, [bounds, editing, height, inspector, width]);

  const zoomTo = useCallback((zoom: number) => {
    if (editing()) return;
    setCamera((current) => zoomPreviewCamera(current, {
      x: bounds.width / 2, y: bounds.height / 2,
    }, zoom));
  }, [bounds, editing]);

  const zoomToSelection = useCallback(() => {
    const node = viewport.current;
    if (!node || editing()) return;
    const origin = node.getBoundingClientRect();
    const box = [...node.querySelectorAll<HTMLElement>(`[${SELECTION_BOUNDS_ATTR}]`)]
      .map((element) => element.getBoundingClientRect())
      .find((rect) => rect.width > 0 && rect.height > 0);
    if (!box) return;
    setCamera((current) => {
      const corner = screenToCanvas({ x: box.left - origin.left, y: box.top - origin.top }, current);
      return fitPreviewCamera(
        current,
        { ...corner, width: box.width / current.zoom, height: box.height / current.zoom },
        bounds,
        canvasInsets(inspector, SELECTION_MARGIN),
        SELECTION_ZOOM
      );
    });
  }, [bounds, editing, inspector]);

  const toggleOutside = useCallback(() => setOutside((value) => value === "dim" ? "hide" : "dim"), []);

  const actions = useRef({ fit, zoomTo, zoomToSelection, togglePlayback, zoom: camera.zoom });
  actions.current = { fit, zoomTo, zoomToSelection, togglePlayback, zoom: camera.zoom };

  useEffect(() => {
    if (!identity || width <= 0 || height <= 0 || bounds.width <= 64 || bounds.height <= 264) return;
    const key = `${identity}:${width}:${height}`;
    if (fitted.current === key) return;
    fitted.current = key;
    const saved = savedCameras.get(key);
    if (saved) setCamera(saved);
    else fit();
  }, [bounds, fit, height, identity, width]);

  useLayoutEffect(() => {
    const node = viewport.current;
    const cursor = panning ? "grabbing" : hand || space ? "grab" : null;
    if (cursor) node?.style.setProperty("--remocn-canvas-cursor", cursor);
    else node?.style.removeProperty("--remocn-canvas-cursor");
    node?.toggleAttribute("data-preview-navigation", cursor !== null);
  }, [hand, panning, space]);

  useLayoutEffect(() => {
    viewport.current?.dispatchEvent(new Event("preview-view-change"));
  }, [camera, bounds]);

  useEffect(() => {
    const key = `${identity}:${width}:${height}`;
    return () => {
      if (identity && fitted.current === key) {
        savedCameras.set(key, camera);
        if (savedCameras.size > 50) savedCameras.delete(savedCameras.keys().next().value!);
      }
    };
  }, [camera, height, identity, width]);

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const capture = node.parentElement ?? node;
    const isControl = (event: Event) => event.composedPath().some((item) => item instanceof Element && item.getRootNode() === document && item.matches(INTERACTIVE));
    const point = (event: { clientX: number; clientY: number }) => {
      const rect = node.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const wheel = (event: WheelEvent) => {
      if (isControl(event)) return;
      event.preventDefault();
      if (node.hasAttribute("data-preview-editing")) return;
      const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientHeight : 1;
      if (event.ctrlKey || event.metaKey) {
        const delta = Math.max(-50, Math.min(50, event.deltaY * factor));
        setCamera((current) => zoomPreviewCamera(current, point(event), current.zoom * Math.exp(-delta * 0.01)));
      } else {
        setCamera((current) => panPreviewCamera(current, { x: -event.deltaX * factor, y: -event.deltaY * factor }));
      }
    };
    const overSelection = (event: PointerEvent) =>
      [...node.querySelectorAll<HTMLElement>(`[${SELECTION_BOUNDS_ATTR}]`)].some((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && event.clientX >= rect.left && event.clientX <= rect.right &&
          event.clientY >= rect.top && event.clientY <= rect.bottom;
      });
    const down = (event: PointerEvent) => {
      if (node.hasAttribute("data-preview-editing") || isControl(event) || (event.button !== 0 && event.button !== 1)) return;
      node.focus({ preventScroll: true });
      const background = event.target === node && !overSelection(event);
      if (!(hand || spaceHeld.current || event.button === 1 || background || event.pointerType === "touch")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      drag.current = { id: event.pointerId, point: point(event) };
      node.setPointerCapture(event.pointerId);
      setPanning(true);
    };
    const move = (event: PointerEvent) => {
      const current = drag.current;
      if (!current || current.id !== event.pointerId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const next = point(event);
      setCamera((camera) => panPreviewCamera(camera, { x: next.x - current.point.x, y: next.y - current.point.y }));
      current.point = next;
    };
    const end = (event?: Event) => {
      if (drag.current && event) { event.preventDefault(); event.stopImmediatePropagation(); }
      const current = drag.current;
      drag.current = null;
      setPanning(false);
      if (current && node.hasPointerCapture(current.id)) node.releasePointerCapture(current.id);
    };
    const reset = () => { spaceHeld.current = false; setSpace(false); end(); };
    const shortcut = (event: KeyboardEvent): (() => void) | null => {
      const { fit, zoomTo, zoomToSelection, zoom } = actions.current;
      if ((event.metaKey || event.ctrlKey) && !event.altKey) {
        if (event.key === "0") return () => zoomTo(1);
        if (event.key === "=" || event.key === "+") return () => zoomTo(zoom * ZOOM_STEP);
        if (event.key === "-") return () => zoomTo(zoom / ZOOM_STEP);
        return null;
      }
      if (event.altKey || !event.shiftKey) return null;
      if (event.code === "Digit1") return fit;
      if (event.code === "Digit2") return zoomToSelection;
      return null;
    };
    const typing = (event: Event) => event.composedPath().some((item) => item instanceof Element && item.getRootNode() === document && item.matches(INTERACTIVE) && !item.hasAttribute("data-geometry-handle"));
    const keydown = (event: KeyboardEvent) => {
      if (node.hasAttribute("data-preview-editing") || typing(event) || event.isComposing) return;
      const view = shortcut(event);
      if (view) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!event.repeat || !event.shiftKey) view();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
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
      if (event.code === "Space") { spaceHeld.current = false; setSpace(false); }
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
    camera, bounds, viewport, fit, hand, setHand, zoomTo, zoomToSelection, outside, toggleOutside,
    cursor: panning ? "grabbing" : hand || space ? "grab" : "default",
    transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
    frame: {
      left: camera.x,
      top: camera.y,
      width: width * camera.zoom,
      height: height * camera.zoom,
    },
  };
}
