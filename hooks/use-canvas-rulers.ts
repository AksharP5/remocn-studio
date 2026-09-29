"use client";

import { Effect } from "effect";
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { RULER_WIDTH } from "@/lib/studio/panes";
import {
  type CanvasPoint,
  type CanvasSize,
  type PreviewCamera,
  type RulerTicks,
  rulerTicks,
  SELECTION_BOUNDS_ATTR,
} from "@/lib/studio/preview-camera";
import { type StudioSettings, saveCanvasRulers } from "@/lib/studio/settings";
import type { CameraView } from "./use-preview-camera";

export const RULER_SIZE = RULER_WIDTH;

const TYPING =
  "button,input,textarea,select,a,[contenteditable],[data-canvas-chrome]";
const LABEL_FONT = "10px ui-sans-serif, system-ui, sans-serif";

type Axis = "horizontal" | "vertical";

interface Extent {
  end: number;
  start: number;
}

interface RulerMarks {
  pointer: number | null;
  selection: Extent | null;
}

function typing(event: Event) {
  return event
    .composedPath()
    .some(
      (item) =>
        item instanceof Element &&
        item.getRootNode() === document &&
        item.matches(TYPING) &&
        !item.hasAttribute("data-geometry-handle")
    );
}

function overChrome(event: Event) {
  return event
    .composedPath()
    .some(
      (item) =>
        item instanceof Element &&
        item.getRootNode() === document &&
        item.hasAttribute("data-canvas-chrome")
    );
}

export function isRulerToggle(event: KeyboardEvent) {
  return (
    event.code === "KeyR" &&
    event.shiftKey &&
    !(event.metaKey || event.ctrlKey || event.altKey || event.repeat)
  );
}

function selectionBox(node: HTMLElement): DOMRect | null {
  return (
    [...node.querySelectorAll<HTMLElement>(`[${SELECTION_BOUNDS_ATTR}]`)]
      .map((element) => element.getBoundingClientRect())
      .find((rect) => rect.width > 0 && rect.height > 0) ?? null
  );
}

interface Painter {
  context: CanvasRenderingContext2D;
  horizontal: boolean;
  length: number;
  thickness: number;
}

function stroke(
  { context, horizontal }: Painter,
  at: number,
  from: number,
  to: number
) {
  const position = Math.round(at) + 0.5;
  if (horizontal) {
    context.moveTo(position, from);
    context.lineTo(position, to);
  } else {
    context.moveTo(from, position);
    context.lineTo(to, position);
  }
}

function paintSelection(
  painter: Painter,
  start: number,
  end: number,
  ink: string
) {
  const { context, horizontal, thickness } = painter;
  context.globalAlpha = 0.2;
  context.fillStyle = ink;
  if (horizontal) {
    context.fillRect(start, 0, end - start, thickness);
  } else {
    context.fillRect(0, start, thickness, end - start);
  }
  context.globalAlpha = 1;
  context.strokeStyle = ink;
  context.beginPath();
  stroke(painter, start, 0, thickness);
  stroke(painter, end, 0, thickness);
  context.stroke();
}

function paintTicks(
  painter: Painter,
  ticks: RulerTicks,
  toScreen: (value: number) => number,
  ink: string
) {
  const { context, horizontal, thickness } = painter;
  context.strokeStyle = ink;
  context.globalAlpha = 0.5;
  context.beginPath();
  for (const value of ticks.minor) {
    stroke(painter, toScreen(value), thickness - 4, thickness);
  }
  context.stroke();
  context.globalAlpha = 1;
  context.beginPath();
  for (const value of ticks.major) {
    stroke(painter, toScreen(value), thickness - 8, thickness);
  }
  context.stroke();

  context.fillStyle = ink;
  context.font = LABEL_FONT;
  context.textBaseline = "top";
  for (const value of ticks.major) {
    const at = Math.round(toScreen(value)) + 3;
    if (horizontal) {
      context.fillText(String(value), at, 3);
    } else {
      context.save();
      context.translate(3, at);
      context.rotate(-Math.PI / 2);
      context.textAlign = "right";
      context.fillText(String(value), 0, 0);
      context.restore();
    }
  }
}

function paintEdge(painter: Painter, ink: string) {
  const { context, horizontal, length, thickness } = painter;
  context.strokeStyle = ink;
  context.beginPath();
  if (horizontal) {
    context.moveTo(0, thickness - 0.5);
    context.lineTo(length, thickness - 0.5);
  } else {
    context.moveTo(thickness - 0.5, 0);
    context.lineTo(thickness - 0.5, length);
  }
  context.stroke();
}

function prepare(canvas: HTMLCanvasElement, axis: Axis): Painter | null {
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.round(rect.width * ratio);
  const height = Math.round(rect.height * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);
  const horizontal = axis === "horizontal";
  return {
    context,
    horizontal,
    length: horizontal ? rect.width : rect.height,
    thickness: horizontal ? rect.height : rect.width,
  };
}

function drawRuler(
  canvas: HTMLCanvasElement,
  axis: Axis,
  origin: DOMRect,
  camera: PreviewCamera,
  marks: RulerMarks
) {
  const painter = prepare(canvas, axis);
  if (!painter) {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const start = painter.horizontal
    ? rect.left - origin.left
    : rect.top - origin.top;
  const offset = start - (painter.horizontal ? camera.x : camera.y);
  const toScreen = (value: number) => value * camera.zoom - offset;
  const style = getComputedStyle(canvas);
  const ink = style.color;
  const mark = style.getPropertyValue("--ruler-mark").trim() || ink;
  const edge = style.getPropertyValue("--ruler-edge").trim() || ink;

  if (marks.selection) {
    paintSelection(
      painter,
      toScreen(marks.selection.start),
      toScreen(marks.selection.end),
      mark
    );
  }
  paintTicks(
    painter,
    rulerTicks(
      offset / camera.zoom,
      (offset + painter.length) / camera.zoom,
      camera.zoom
    ),
    toScreen,
    ink
  );
  paintEdge(painter, edge);
  if (marks.pointer !== null) {
    painter.context.strokeStyle = mark;
    painter.context.beginPath();
    stroke(painter, marks.pointer - start, 0, painter.thickness);
    painter.context.stroke();
  }
}

export type CanvasRulersState = ReturnType<typeof useCanvasRulers>;

export function useCanvasRulers({
  camera,
  selection,
  settings,
  video,
  viewport,
}: {
  camera: CameraView;
  selection: unknown;
  settings: StudioSettings | null;
  video: CanvasSize | null;
  viewport: RefObject<HTMLElement | null>;
}) {
  const [chosen, setChosen] = useState<boolean | null>(null);
  const shown = chosen ?? settings?.canvasRulers ?? true;
  const top = useRef<HTMLCanvasElement>(null);
  const left = useRef<HTMLCanvasElement>(null);
  const pointer = useRef<CanvasPoint | null>(null);
  const frame = useRef(0);

  const toggle = useCallback(() => {
    const next = !shown;
    setChosen(next);
    Effect.runFork(saveCanvasRulers(next));
  }, [shown]);
  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;

  const draw = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    const node = viewport.current;
    if (!(node && shown && video)) {
      return;
    }
    const origin = node.getBoundingClientRect();
    const current = camera.current();
    const box = selectionBox(node);
    const extent = (start: number, size: number, shift: number) => ({
      end: (start + size - shift) / current.zoom,
      start: (start - shift) / current.zoom,
    });
    const held = pointer.current;
    if (top.current) {
      drawRuler(top.current, "horizontal", origin, current, {
        pointer: held ? held.x : null,
        selection: box
          ? extent(box.left - origin.left, box.width, current.x)
          : null,
      });
    }
    if (left.current) {
      drawRuler(left.current, "vertical", origin, current, {
        pointer: held ? held.y : null,
        selection: box
          ? extent(box.top - origin.top, box.height, current.y)
          : null,
      });
    }
  }, [camera, shown, video, viewport]);

  const schedule = useCallback(() => {
    if (frame.current === 0) {
      frame.current = requestAnimationFrame(draw);
    }
  }, [draw]);

  useEffect(() => {
    const canvases = [top.current, left.current].filter(
      (canvas) => canvas !== null
    );
    if (canvases.length === 0) {
      return;
    }
    const observer = new ResizeObserver(schedule);
    for (const canvas of canvases) {
      observer.observe(canvas);
    }
    return () => observer.disconnect();
  }, [schedule]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the camera and the selection are what the rulers show, so they are the redraw's trigger
  useLayoutEffect(() => {
    draw();
  }, [camera, draw, selection]);

  useEffect(() => {
    const node = viewport.current;
    if (!node) {
      return;
    }
    const capture = node.parentElement ?? node;
    const move = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      pointer.current =
        inside && !overChrome(event)
          ? { x: event.clientX - rect.left, y: event.clientY - rect.top }
          : null;
      schedule();
    };
    const leave = () => {
      pointer.current = null;
      schedule();
    };
    const keydown = (event: KeyboardEvent) => {
      if (
        !isRulerToggle(event) ||
        node.hasAttribute("data-preview-editing") ||
        typing(event) ||
        event.isComposing
      ) {
        return;
      }
      event.preventDefault();
      toggleRef.current();
    };
    capture.addEventListener("pointermove", move, true);
    capture.addEventListener("pointerup", schedule, true);
    capture.addEventListener("pointerleave", leave);
    capture.addEventListener("keyup", schedule, true);
    node.addEventListener("preview-view-change", schedule);
    node.addEventListener("keydown", keydown);
    return () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      capture.removeEventListener("pointermove", move, true);
      capture.removeEventListener("pointerup", schedule, true);
      capture.removeEventListener("pointerleave", leave);
      capture.removeEventListener("keyup", schedule, true);
      node.removeEventListener("preview-view-change", schedule);
      node.removeEventListener("keydown", keydown);
    };
  }, [schedule, viewport]);

  return { left, shown, size: shown ? RULER_SIZE : 0, toggle, top };
}
