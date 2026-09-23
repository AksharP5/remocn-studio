import { eventElement, focusSurface, lockCamera, onViewChange, overlayRoot, styleRoot, surfaceEvents } from "./surface";
import {
  GEOMETRY_KEYS,
  type GeometryHandle,
  type GeometryValues,
  poseGeometry,
  unposeGeometry,
  transformGeometry,
} from "../shared/studio-geometry";
import { onCommand, post } from "./bridge";
import {
  type GeometryConfig,
  type GeometryTarget,
  geometryTarget,
  renderedGeometry,
} from "./geometry-target";
import { managedIdentity, managedRoot } from "./managed-objects";
import { OVERLAY_ATTR } from "./picker";

const MARKER = "data-remocn-transform";
const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w", "rotate"] as const;
interface Gesture {
  target: GeometryTarget;
  handle: GeometryHandle;
  pointer: number;
  x: number;
  y: number;
  centerX: number;
  centerY: number;
  angle: number;
  turn: number;
  values: GeometryValues;
  requestId: string;
  phase: "pending" | "dragging" | "committing";
  accepted: boolean;
  restore: () => void;
  rule: CSSStyleDeclaration;
  frame: number;
}

export function createGeometryEditor(
  container: HTMLElement,
  accent: string,
  depth: number,
  pause: () => void,
  currentFrame: () => number,
  onChange: () => void
) {
  let config: GeometryConfig | null = null;
  let target: GeometryTarget | null = null;
  let gesture: Gesture | null = null;
  let painting = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  let suppressClick = false;
  let clickTimer: ReturnType<typeof setTimeout> | undefined;
  const frame = overlay("div", depth);
  Object.assign(frame.style, {
    border: `1px solid ${accent}`,
    boxSizing: "border-box",
    transformOrigin: "center",
  });
  const label = overlay("div", depth + 1);
  Object.assign(label.style, {
    padding: "2px 6px",
    borderRadius: "3px",
    background: accent,
    color: "#101820",
    font: "500 11px/1.4 system-ui, sans-serif",
    whiteSpace: "nowrap",
  });
  const notice = overlay("div", depth + 3);
  notice.setAttribute("role", "status");
  Object.assign(notice.style, {
    left: "8px",
    bottom: "8px",
    maxWidth: "calc(100vw - 16px)",
    borderRadius: "4px",
    padding: "6px 8px",
    background: "#222",
    color: "#f3f3f3",
    font: "12px/1.4 system-ui, sans-serif",
  });
  const handles = HANDLES.map((handle) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute(OVERLAY_ATTR, "");
    button.dataset.geometryHandle = handle;
    button.setAttribute(
      "aria-label",
      handle === "rotate" ? "Rotate object" : `Resize ${handle}`
    );
    button.title =
      handle === "rotate"
        ? "Rotate · Shift snaps to 15°"
        : "Resize · Shift keeps proportions at corners";
    const size = matchMedia("(pointer: coarse)").matches ? 44 : 24;
    Object.assign(button.style, {
      position: "absolute",
      width: `${size}px`,
      height: `${size}px`,
      padding: "0",
      margin: "0",
      border: "0",
      background: "transparent",
      pointerEvents: "auto",
      transform: "translate(-50%, -50%)",
      touchAction: "none",
      display: "grid",
      placeItems: "center",
    });
    button.style.left = handle.includes("w")
      ? "0"
      : handle.includes("e") && handle !== "rotate"
        ? "100%"
        : "50%";
    button.style.top =
      handle === "rotate"
        ? "-26px"
        : handle.includes("n")
          ? "0"
          : handle.includes("s")
            ? "100%"
            : "50%";
    const dot = document.createElement("span");
    Object.assign(dot.style, {
      width: "8px",
      height: "8px",
      border: `1px solid ${accent}`,
      background: "#fff",
      borderRadius: handle === "rotate" ? "50%" : "0",
      pointerEvents: "none",
    });
    button.append(dot);
    frame.append(button);
    return { button, handle };
  });
  overlayRoot().append(frame, label, notice);

  const explain = (error: string) => {
    notice.textContent = error;
    notice.style.display = "block";
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      notice.style.display = "none";
    }, 5000);
  };
  const reset = () => {
    const previous = gesture;
    gesture = null;
    lockCamera(frame, false);
    clearTimeout(timer);
    if (previous) {
      previous.restore();
      if (
        previous.pointer >= 0 &&
        container.hasPointerCapture(previous.pointer)
      )
        container.releasePointerCapture(previous.pointer);
    }
    onChange();
  };
  const cancel = () => {
    if (gesture && gesture.phase !== "pending") {
      post({ type: "studio.geometry.cancel", requestId: gesture.requestId });
    }
    reset();
  };
  const settle = () => {
    if (
      gesture?.phase === "committing" &&
      gesture.accepted &&
      (!gesture.target.node.isConnected ||
        renderedGeometry(gesture.target.node, gesture.values))
    )
      reset();
  };
  const draw = (current: GeometryTarget, values: GeometryValues) => {
    const rendered = poseGeometry(values, current.pose);
    const rect = current.node.getBoundingClientRect();
    const width = rendered.width * current.scale;
    const height = rendered.height * current.scale;
    const rotation = rendered.rotation + current.parentRotation;
    Object.assign(frame.style, {
      display: "block",
      left: `${rect.left + rect.width / 2 - width / 2}px`,
      top: `${rect.top + rect.height / 2 - height / 2}px`,
      width: `${width}px`,
      height: `${height}px`,
      transform: `rotate(${rotation}deg)`,
    });
    label.textContent = `${format(rendered.width)} × ${format(rendered.height)}${gesture?.handle === "rotate" ? ` · ${format(rendered.rotation)}°` : ""}`;
    Object.assign(label.style, {
      display: "block",
      left: `${Math.max(4, Math.min(rect.left + rect.width / 2 - label.offsetWidth / 2, innerWidth - label.offsetWidth - 4))}px`,
      top: `${Math.max(4, Math.min(rect.bottom + 8, innerHeight - 24))}px`,
    });
    for (const { button, handle } of handles) {
      const disabled = handle === "rotate" && current.binding.rotation === null;
      button.style.display = disabled ? "none" : "grid";
      button.setAttribute(
        "aria-disabled",
        String(gesture?.phase === "committing" || !config?.enabled)
      );
      button.style.cursor = cursor(handle, rotation);
    }
  };
  const paint = (node: Element | null): boolean => {
    if (gesture && currentFrame() !== gesture.frame) cancel();
    if (gesture) {
      draw(gesture.target, gesture.values);
      return true;
    }
    target = geometryTarget(node, config);
    if (!target) {
      frame.style.display = "none";
      label.style.display = "none";
      return false;
    }
    draw(target, target.values);
    return true;
  };
  const apply = () => {
    const current = gesture;
    if (!current) return;
    if (currentFrame() !== current.frame) {
      cancel();
      return;
    }
    const { rule } = current;
    const rendered = poseGeometry(current.values, current.target.pose);
    rule.setProperty("left", `${rendered.x}px`, "important");
    rule.setProperty("top", `${rendered.y}px`, "important");
    rule.setProperty("width", `${rendered.width}px`, "important");
    rule.setProperty("height", `${rendered.height}px`, "important");
    rule.setProperty("rotate", `${rendered.rotation}deg`, "important");
    draw(current.target, current.values);
  };
  const begin = (current: Gesture) => {
    if (current.phase !== "pending") return;
    current.phase = "dragging";
    pause();
    post({
      type: "studio.geometry.begin",
      requestId: current.requestId,
      binding: current.target.binding,
      generation: current.target.generation,
      objectId: current.target.objectId,
      video: current.target.video,
      values: current.target.values,
    });
  };
  const start = (
    current: GeometryTarget,
    handle: GeometryHandle,
    pointer: number,
    x: number,
    y: number
  ) => {
    const node = current.node;
    const rect = node.getBoundingClientRect();
    const token = crypto.randomUUID();
    const oldMarker = node.getAttribute(MARKER);
    const sheet = document.createElement("style");
    sheet.setAttribute(OVERLAY_ATTR, "");
    sheet.textContent = `[${MARKER}="${token}"] { transition: none !important; }
      .__remotion-player, .__remotion-player * { cursor: ${cursor(handle, poseGeometry(current.values, current.pose).rotation + current.parentRotation)} !important; user-select: none !important; }`;
    node.setAttribute(MARKER, token);
    styleRoot().append(sheet);
    const rule = (sheet.sheet!.cssRules[0] as CSSStyleRule).style;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const next: Gesture = {
      target: current,
      handle,
      pointer,
      x,
      y,
      centerX,
      centerY,
      angle: Math.atan2(y - centerY, x - centerX),
      turn: 0,
      values: current.values,
      requestId: crypto.randomUUID(),
      phase: "pending",
      accepted: false,
      rule,
      frame: currentFrame(),
      restore: () => {
        sheet.remove();
        if (oldMarker === null) node.removeAttribute(MARKER);
        else node.setAttribute(MARKER, oldMarker);
      },
    };
    gesture = next;
    lockCamera(frame, true);
    return next;
  };
  const transform = (
    current: Gesture,
    dx: number,
    dy: number,
    shift: boolean,
    angle: number
  ) => {
    const { target } = current;
    const { pose } = target;
    const bounds = Object.fromEntries(
      GEOMETRY_KEYS.map((key) => {
        const field = target.bounds[key];
        return [
          key,
          {
            min:
              field?.min == null
                ? null
                : field.min * pose.multiplier[key] + pose.offset[key],
            max:
              field?.max == null
                ? null
                : field.max * pose.multiplier[key] + pose.offset[key],
          },
        ];
      })
    );
    for (const key of ["width", "height"] as const) {
      bounds[key].min = Math.max(
        1,
        Math.max(1, target.bounds[key]?.min ?? 1) * pose.multiplier[key] +
          pose.offset[key]
      );
    }
    const next = unposeGeometry(
      transformGeometry(
        poseGeometry(target.values, pose),
        current.handle,
        dx,
        dy,
        shift,
        bounds,
        angle,
        pose.scale
      ),
      pose
    );
    for (const key of GEOMETRY_KEYS) {
      // Inverting a motion mapping must not turn unchanged fields into tiny edits.
      if (Math.abs(next[key] - target.values[key]) < 1e-9)
        next[key] = target.values[key];
      const bound = target.bounds[key];
      if (
        !Number.isFinite(next[key]) ||
        next[key] < (bound?.min ?? -Infinity) - 1e-9 ||
        next[key] > (bound?.max ?? Infinity) + 1e-9
      )
        return target.values;
      next[key] = Math.min(
        bound?.max ?? Infinity,
        Math.max(bound?.min ?? -Infinity, next[key])
      );
    }
    return next;
  };
  const move = (event: PointerEvent) => {
    const current = gesture;
    if (
      !current ||
      current.pointer !== event.pointerId ||
      current.phase === "committing"
    )
      return;
    if (currentFrame() !== current.frame) {
      cancel();
      return;
    }
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (current.phase === "pending" && Math.hypot(dx, dy) < 3) return;
    event.preventDefault();
    event.stopPropagation();
    begin(current);
    if (current.handle === "rotate") {
      const next = Math.atan2(
        event.clientY - current.centerY,
        event.clientX - current.centerX
      );
      const delta = next - current.angle;
      current.turn +=
        (Math.atan2(Math.sin(delta), Math.cos(delta)) * 180) / Math.PI;
      current.angle = next;
    }
    const angle = (current.target.parentRotation * Math.PI) / 180;
    current.values = transform(
      current,
      (Math.cos(angle) * dx + Math.sin(angle) * dy) /
        current.target.parentScale,
      (-Math.sin(angle) * dx + Math.cos(angle) * dy) /
        current.target.parentScale,
      event.shiftKey,
      current.turn
    );
    if (painting === 0)
      painting = requestAnimationFrame(() => {
        painting = 0;
        apply();
      });
  };
  const commit = () => {
    const current = gesture;
    if (!current || current.phase === "committing") return;
    if (
      current.phase === "pending" ||
      GEOMETRY_KEYS.every(
        (key) => current.values[key] === current.target.values[key]
      )
    ) {
      cancel();
      return;
    }
    apply();
    if (gesture !== current) return;
    current.phase = "committing";
    suppressClick = current.pointer >= 0;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      suppressClick = false;
    }, 0);
    post({
      type: "studio.geometry.commit",
      requestId: current.requestId,
      values: current.values,
    });
    timer = setTimeout(() => {
      cancel();
      explain(
        "The transform did not finish updating. Check its properties before trying again."
      );
    }, 6000);
  };
  const up = (event: PointerEvent) => {
    if (!gesture || gesture.pointer !== event.pointerId) return;
    if (gesture.phase !== "pending") {
      move(event);
      event.preventDefault();
      event.stopPropagation();
    }
    commit();
  };
  const lost = (event: PointerEvent) => {
    if (gesture?.pointer === event.pointerId && gesture.phase !== "committing")
      cancel();
  };
  const blur = () => {
    if (gesture?.phase !== "committing") cancel();
  };
  const resize = () => {
    if (gesture && gesture.phase !== "committing") cancel();
    else onChange();
  };
  const click = (event: MouseEvent) => {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const key = (event: KeyboardEvent) => {
    if (
      !(event.target instanceof HTMLElement) ||
      !frame.contains(event.target) ||
      !target ||
      gesture ||
      !config?.enabled
    )
      return;
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    const handle = event.target.dataset.geometryHandle as GeometryHandle;
    if (!handle) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 10 : 1;
    const dx =
      event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
    const dy =
      event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0;
    pause();
    const fresh = geometryTarget(target.node, config);
    if (!fresh) return;
    const current = start(fresh, handle, -1, 0, 0);
    begin(current);
    current.values = transform(current, dx, dy, false, dx || dy);
    commit();
  };

  const stopCommands = onCommand((command) => {
    if (command.type === "studio.geometry.config") {
      config = command;
      if (
        gesture &&
        gesture.phase !== "committing" &&
        (!command.enabled ||
          command.objectId !== gesture.target.objectId ||
          command.generation !== gesture.target.generation)
      )
        cancel();
      onChange();
    } else if (
      command.type === "studio.geometry.result" &&
      command.requestId === gesture?.requestId
    ) {
      if (command.error) {
        reset();
        explain(command.error);
      } else {
        gesture.accepted = true;
        settle();
      }
    } else if (
      ["seek", "replay", "transport.toggle", "transport.step"].includes(
        command.type
      )
    ) {
      cancel();
    }
  });
  post({ type: "studio.geometry.request" });
  const observer = new MutationObserver(() => {
    if (gesture) {
      const identity = managedIdentity(gesture.target.node);
      if (
        !gesture.target.node.isConnected ||
        identity?.generation !== gesture.target.generation ||
        currentFrame() !== gesture.frame ||
        (gesture.phase !== "committing" &&
          (gesture.target.node.getAttribute("data-studio-geometry") !==
            gesture.target.bindingAttribute ||
            gesture.target.node.getAttribute("data-studio-geometry-pose") !==
              gesture.target.poseAttribute ||
            gesture.target.node.getAttribute("data-studio-geometry-frame") !==
              gesture.target.frameAttribute))
      ) {
        cancel();
      } else settle();
    }
    onChange();
  });
  observer.observe(container, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      "data-studio-generation",
      "data-studio-geometry",
      "data-studio-geometry-values",
      "data-studio-geometry-pose",
      "data-studio-geometry-frame",
    ],
  });
  surfaceEvents.addEventListener("pointermove", move, true);
  surfaceEvents.addEventListener("pointerup", up, true);
  surfaceEvents.addEventListener("pointercancel", lost, true);
  surfaceEvents.addEventListener("lostpointercapture", lost, true);
  window.addEventListener("blur", blur);
  window.addEventListener("resize", resize);
  const stopView = onViewChange(resize);
  surfaceEvents.addEventListener("click", click, true);
  frame.addEventListener("keydown", key);

  return {
    active: () => gesture !== null,
    cancel,
    escape: () => {
      if (!gesture) return false;
      if (gesture.phase !== "committing") cancel();
      return true;
    },
    contains: (eventTarget: EventTarget | null) =>
      eventTarget instanceof Node && frame.contains(eventTarget),
    paint,
    movable: (node: Element | null) => target !== null && target.node === node,
    pointerDown: (event: PointerEvent) => {
      if (
        gesture ||
        !target ||
        !config?.enabled ||
        event.button !== 0 ||
        event.altKey
      )
        return false;
      const hit = eventElement(event);
      const handle = hit?.closest<HTMLElement>("[data-geometry-handle]");
      const mode =
        handle && frame.contains(handle)
          ? (handle.dataset.geometryHandle as GeometryHandle)
          : "move";
      if (
        mode === "move" &&
        (!hit || managedRoot(hit, container) !== target.node)
      )
        return false;
      if (mode === "rotate" && target.binding.rotation === null) return false;
      const fresh = geometryTarget(target.node, config);
      if (!fresh) return false;
      event.preventDefault();
      event.stopPropagation();
      pause();
      focusSurface();
      handle?.focus({ preventScroll: true });
      start(fresh, mode, event.pointerId, event.clientX, event.clientY);
      container.setPointerCapture(event.pointerId);
      return true;
    },
    stop: () => {
      cancel();
      stopCommands();
      observer.disconnect();
      cancelAnimationFrame(painting);
      clearTimeout(noticeTimer);
      clearTimeout(clickTimer);
      surfaceEvents.removeEventListener("pointermove", move, true);
      surfaceEvents.removeEventListener("pointerup", up, true);
      surfaceEvents.removeEventListener("pointercancel", lost, true);
      surfaceEvents.removeEventListener("lostpointercapture", lost, true);
      window.removeEventListener("blur", blur);
      window.removeEventListener("resize", resize);
      stopView();
      surfaceEvents.removeEventListener("click", click, true);
      frame.remove();
      label.remove();
      notice.remove();
    },
  };
}

function overlay(tag: "div", depth: number) {
  const node = document.createElement(tag);
  node.setAttribute(OVERLAY_ATTR, "");
  Object.assign(node.style, {
    position: "fixed",
    zIndex: String(depth),
    display: "none",
    pointerEvents: "none",
  });
  return node;
}
function format(value: number) {
  return String(Math.round(value * 10) / 10);
}
function cursor(handle: GeometryHandle, rotation: number): string {
  if (handle === "move") return "move";
  if (handle === "rotate") return "crosshair";
  const x = handle.includes("e") ? 1 : handle.includes("w") ? -1 : 0;
  const y = handle.includes("s") ? 1 : handle.includes("n") ? -1 : 0;
  const angle = (Math.atan2(y, x) * 180) / Math.PI + rotation;
  const index = ((Math.round(angle / 45) % 4) + 4) % 4;
  return ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"][index];
}
