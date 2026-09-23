"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  fitPreviewCamera,
  INITIAL_PREVIEW_CAMERA,
  panPreviewCamera,
  zoomPreviewCamera,
  type CanvasPoint,
  type PreviewCamera,
} from "@/lib/studio/preview-camera";

const savedCameras = new Map<string, PreviewCamera>();

const INTERACTIVE = "button,input,textarea,select,a,[contenteditable],[data-canvas-chrome]";

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

  const fit = useCallback(() => {
    if (viewport.current?.hasAttribute("data-preview-editing")) return;
    setCamera((current) => fitPreviewCamera(current, { x: 0, y: 0, width, height }, bounds, {
      top: 104, bottom: 160, left: 32, right: inspector ? 376 : 32,
    }));
  }, [bounds, height, inspector, width]);

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

  const zoomTo = useCallback((zoom: number) => {
    if (viewport.current?.hasAttribute("data-preview-editing")) return;
    setCamera((current) => zoomPreviewCamera(current, {
      x: bounds.width / 2, y: bounds.height / 2,
    }, zoom));
  }, [bounds]);

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const capture = node.parentElement ?? node;
    const isControl = (event: Event) => event.composedPath().some((item) => item instanceof Element && item.getRootNode() === document && item.matches(INTERACTIVE));
    const editing = () => node.hasAttribute("data-preview-editing");
    const point = (event: { clientX: number; clientY: number }) => {
      const rect = node.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const wheel = (event: WheelEvent) => {
      if (isControl(event)) return;
      if (editing()) { event.preventDefault(); return; }
      event.preventDefault();
      const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientHeight : 1;
      if (event.ctrlKey || event.metaKey) {
        const delta = Math.max(-50, Math.min(50, event.deltaY * factor));
        setCamera((current) => zoomPreviewCamera(current, point(event), current.zoom * Math.exp(-delta * 0.01)));
      } else {
        setCamera((current) => panPreviewCamera(current, { x: -event.deltaX * factor, y: -event.deltaY * factor }));
      }
    };
    const down = (event: PointerEvent) => {
      if (editing() || isControl(event) || (event.button !== 0 && event.button !== 1)) return;
      node.focus({ preventScroll: true });
      const background = event.target === node;
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
    const keydown = (event: KeyboardEvent) => {
      if (editing() || isControl(event) || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.code === "Space") {
        event.preventDefault();
        event.stopImmediatePropagation();
        spaceHeld.current = true;
        setSpace(true);
      } else if (event.key.toLowerCase() === "k" && !event.repeat) {
        event.preventDefault();
        togglePlayback();
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
  }, [hand, togglePlayback]);

  return {
    camera, bounds, viewport, fit, hand, setHand, zoomTo,
    cursor: panning ? "grabbing" : hand || space ? "grab" : "default",
    transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
  };
}
