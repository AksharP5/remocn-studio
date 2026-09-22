import { anchorOf, CANVAS_SELECTOR } from "./anchor";
import { assetBase, assetNames, forgetAssets, staticBase } from "./assets";
import { post } from "./bridge";
import { displayName, fiberOf, nearestInFibers } from "./fiber";
import { createInlineTextEditor } from "./inline-text";
import { createGeometryEditor } from "./geometry";
import { managedIdentity, managedRoots } from "./managed-objects";
import { covers, nearText, OVERLAY_ATTR, pickAt } from "./picker";
import {
  absolutise,
  formatFrame,
  projectFrames,
  type SourceSpot,
  type StackFrame,
  truncateMarkup,
} from "./source";
import { windowOf } from "./timing";
import {
  controlsAt,
  controlsChain,
  nameIn,
  plainName,
  type TargetWhere,
  type TuningTarget,
} from "./tuning";
import { targetsOf } from "./tuning-runtime";

const CANVAS = CANVAS_SELECTOR;
const MARKUP_LIMIT = 4000;
const PARENTS = 3;
const SELECTION_ATTR = "data-remocn-selection";
const PULSE_CLASS = "remocn-selection-pulse";
const CURSOR = "--remocn-inspect-cursor";
const EDITING =
  "input, textarea, select, [contenteditable]:not([contenteditable='false'])";
// Hand-copied from --reference's dark value in app/globals.css — this file is
// compiled by the project's webpack and cannot import the app's theme.
export const ACCENT = "oklch(0.715 0.143 215.221)";
export const ACCENT_SOFT = "oklch(0.715 0.143 215.221 / 0.12)";
const LABEL_INK = "oklch(0.18 0.01 260)";
export const TOP = 2_147_483_000;

const WRAPPERS = new Set([
  "AbsoluteFill",
  "Composition",
  "Fill",
  "Folder",
  "Freeze",
  "Loop",
  "Sequence",
  "Series",
  "Still",
  "TransitionSeries",
]);

// Remotion's own plumbing, by the shape of its names: the three
// `*SequenceRefForwardingFunction`s every `<Sequence>` renders through, and
// the higher-order component `Interactive.withSchema` wraps a component in.
const INTERNAL = /RefForwardingFunction$|^withInteractivitySchema\(/;

interface GrabSource {
  columnNumber: number | null;
  componentName: string | null;
  filePath: string;
  lineNumber: number | null;
}

interface GrabApi {
  getDisplayName: (element: Element) => string | null;
  getSource: (element: Element) => Promise<GrabSource | null>;
  registerPlugin: (plugin: unknown) => void;
}

interface GrabModule {
  getStack: (element: Element) => Promise<StackFrame[] | null>;
  init: (options: Record<string, unknown>) => GrabApi;
}

export type InspectStatus = "armed" | "disarmed" | "no-canvas" | "no-grab";

export interface Scene {
  durationInFrames: number;
  frame: number;
  from: number;
  name: string;
}

export interface VideoConfig {
  durationInFrames: number;
  fps: number;
  height: number;
  width: number;
}

export interface Stage {
  composition: () => string;
  fps: () => number;
  frame: () => number;
  pause?: () => void;
  // What the codemod resolves `fps`, `width`, `height` and `durationInFrames`
  // to when a prop is written as an expression over them. Only the page knows
  // it, so it rides with the selection rather than being asked for later.
  video: () => VideoConfig;
}

interface Session {
  readonly box: HTMLElement;
  readonly container: HTMLElement;
  readonly inline: ReturnType<typeof createInlineTextEditor>;
  readonly geometry: ReturnType<typeof createGeometryEditor>;
  readonly label: HTMLElement;
  readonly stage: Stage;
  readonly stop: () => void;
}

let api: GrabApi | null = null;
let session: Session | null = null;
let hovered: Element | null = null;
let exact = false;
let point: { x: number; y: number } | null = null;
let painting = 0;
let pickVersion = 0;
// Where each `Interactive` of the last selection sits, so switching in the
// pane can point back at it. Captured at pick time, which is the only moment
// the whole chain is known.
let chain = new Map<string, Element>();
let picked: Element | null = null;
let selected: Element | null = null;
let managedSelected: { id: string; video: string; generation: string } | null =
  null;
let selection: { box: HTMLElement; tag: HTMLElement } | null = null;

export function canvas(): HTMLElement | null {
  return document.querySelector<HTMLElement>(CANVAS);
}

export function armInspect(armed: boolean, stage: Stage): InspectStatus {
  if (!armed) {
    close();
    return "disarmed";
  }

  const container = canvas();

  if (container === null) {
    return "no-canvas";
  }

  if (session?.container !== container) {
    close();
    session = start(container, stage);
  }

  return document.querySelector("[data-studio-object]") !== null ||
    grab() !== null
    ? "armed"
    : "no-grab";
}

/**
 * Draw the box on one `Interactive` of the current selection, or clear it.
 *
 * The pane shows one link of the chain at a time, and nothing on screen said
 * which — `<Series>` and `CameraRig` are names, not places. This paints inside
 * the preview document, next to the hover box and for the same reason: it
 * shares a document with the pixels, so it cannot drift from them.
 */
// The box belongs to the *card*, not to the mode. Turning Inspect off while the
// pane is up still means "stop picking, not forget what I picked" — but once
// Cancel has closed the pane there is nothing on screen the box refers to, and
// leaving it there burns a rectangle and a component name into a frame the
// person is judging by eye, with no mode on and nothing to click to remove it.
export function highlightTarget(targetId: string | null, open: boolean): void {
  if (managedSelected !== null) {
    return;
  }
  if (!open) {
    selected = null;
    paint();
    return;
  }

  selected = targetId === null ? picked : (chain.get(targetId) ?? picked);
  paint();
}

export function highlightManaged(
  objectId: string | null,
  video: string,
  generation: string
): void {
  managedSelected =
    objectId === null ? null : { generation, id: objectId, video };
  selected = null;
  paint();
}

export function clearSelection(): void {
  session?.inline.cancel();
  session?.geometry.cancel();
  pickVersion += 1;
  chain = new Map();
  picked = null;
  selected = null;
  // The rebuild that clears a selection is a turn having written to the
  // project, which is the one thing that changes what is in `public/`.
  forgetAssets();
  paint();
}

export function repaint(): void {
  if (session !== null && session.container !== canvas()) {
    armInspect(true, session.stage);
  }
  paint();
}

export function dismissSelection(notify = true): void {
  session?.inline.cancel();
  session?.geometry.cancel();
  pickVersion += 1;
  chain = new Map();
  picked = null;
  selected = null;
  managedSelected = null;
  hovered = null;
  paint();
  if (notify) {
    post({ type: "inspect.clear" });
  }
}

function grab(): GrabApi | null {
  if (api !== null) {
    return api;
  }

  const module = grabModule();
  const container = canvas();

  if (module === null || container === null) {
    return null;
  }

  api = module.init({
    activationKey: () => false,
    activationMode: "toggle",
    container,
    enabled: true,
    maxContextLines: PARENTS,
    telemetry: false,
  });

  api.registerPlugin({
    name: "remocn-studio",
    theme: {
      dragBox: { enabled: false },
      elementLabel: { enabled: false },
      grabbedBoxes: { enabled: false },
      selectionBox: { enabled: false },
      toolbar: { enabled: false },
    },
  });

  return api;
}

function forceHitTesting(): HTMLStyleElement {
  const style = document.createElement("style");
  style.setAttribute(OVERLAY_ATTR, "");
  style.textContent = `${CANVAS}, ${CANVAS} * {
    pointer-events: auto !important;
    cursor: var(${CURSOR}, default) !important;
  }`;
  document.head.append(style);
  return style;
}

function overCanvas(container: HTMLElement, x: number, y: number): boolean {
  if (!covers(container, x, y)) {
    return false;
  }

  const [top] = document.elementsFromPoint?.(x, y) ?? [];

  return top === undefined || container.contains(top);
}

function start(container: HTMLElement, stage: Stage): Session {
  const { box, label } = overlay();
  const hitTesting = forceHitTesting();
  const cursor = container.style.getPropertyValue(CURSOR);
  const inline = createInlineTextEditor(container, ACCENT, TOP + 3, paint);
  const geometry = createGeometryEditor(
    container,
    ACCENT,
    TOP + 2,
    () => stage.pause?.(),
    () => stage.frame(),
    paint
  );

  container.style.setProperty(CURSOR, "default");

  const onMove = (event: PointerEvent) => {
    if (geometry.active()) return;
    point = { x: event.clientX, y: event.clientY };
    exact = event.altKey;
    schedule(container);
  };

  const onLeave = () => {
    point = null;
    hovered = null;
    container.style.setProperty(CURSOR, "default");
    paint();
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Alt") {
      exact = event.type === "keydown";
      schedule(container);
    }
    if (
      event.type === "keydown" &&
      event.key === "Escape" &&
      !event.defaultPrevented &&
      !(event.target instanceof Element && event.target.closest(EDITING))
    ) {
      event.preventDefault();
      event.stopPropagation();
      if (geometry.escape()) return;
      dismissSelection();
    }
  };

  const onDown = (event: PointerEvent) => {
    if (inline.contains(event.target)) {
      return;
    }
    if (inline.beforePick()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (geometry.pointerDown(event)) return;
    if (
      event.button !== 0 ||
      !overCanvas(container, event.clientX, event.clientY)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const found =
      pickAt(event.clientX, event.clientY, container, event.altKey) ?? hovered;

    if (found === null || found === container) {
      dismissSelection();
      return;
    }

    stage.pause?.();
    window.focus();

    const repeat =
      picked !== null &&
      anchorOf(picked, container) === anchorOf(found, container);

    picked = found;
    selected = found;
    managedSelected = null;
    pickVersion += 1;
    paint();

    if (repeat) {
      pulse();
    }

    report(found, stage, repeat, pickVersion).catch(nothing);
  };

  // A click that picks must never also reach Remotion's `clickToPlay`
  // underneath it.
  const swallow = (event: MouseEvent) => {
    if (inline.contains(event.target) || geometry.contains(event.target)) {
      return;
    }
    if (overCanvas(container, event.clientX, event.clientY)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  window.addEventListener("pointermove", onMove, true);
  window.addEventListener("pointerdown", onDown, true);
  window.addEventListener("pointerup", swallow, true);
  window.addEventListener("click", swallow, true);
  window.addEventListener("dblclick", inline.doubleClick, true);
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("keyup", onKey, true);
  container.addEventListener("pointerleave", onLeave);

  return {
    box,
    container,
    inline,
    geometry,
    label,
    stage,
    stop: () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", swallow, true);
      window.removeEventListener("click", swallow, true);
      window.removeEventListener("dblclick", inline.doubleClick, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
      container.removeEventListener("pointerleave", onLeave);
      if (cursor) {
        container.style.setProperty(CURSOR, cursor);
      } else {
        container.style.removeProperty(CURSOR);
      }
      box.remove();
      label.remove();
      hitTesting.remove();
      inline.stop();
      geometry.stop();
    },
  };
}

function close(): void {
  pickVersion += 1;
  session?.stop();
  session = null;
  hovered = null;
  point = null;
  exact = false;
  paint();
}

function schedule(container: HTMLElement): void {
  if (painting !== 0) {
    return;
  }

  painting = requestAnimationFrame(() => {
    painting = 0;

    if (session === null || point === null) {
      return;
    }

    hovered = pickAt(point.x, point.y, container, exact);
    if (hovered === container) {
      hovered = null;
    }
    container.style.setProperty(
      CURSOR,
      hovered !== null && nearText(hovered, point.x, point.y)
        ? "text"
        : session.geometry.movable(hovered)
          ? "move"
          : "default"
    );
    paint();
  });
}

function overlay(): { box: HTMLElement; label: HTMLElement } {
  const box = drawn(TOP);
  const label = tagged(TOP + 1);

  box.style.border = `1px solid ${ACCENT}`;
  box.style.opacity = "0.55";

  document.body.append(box, label);

  return { box, label };
}

function selectionPair(): { box: HTMLElement; tag: HTMLElement } {
  if (selection?.box.isConnected === true) {
    return selection;
  }

  const box = drawn(TOP - 2);
  const tag = tagged(TOP - 1);

  box.setAttribute(SELECTION_ATTR, "");
  box.style.border = `2px solid ${ACCENT}`;

  document.head.append(pulseStyle());
  document.body.append(box, tag);
  selection = { box, tag };

  return selection;
}

function pulseStyle(): HTMLStyleElement {
  const style = document.createElement("style");
  style.setAttribute(SELECTION_ATTR, "");
  style.textContent = `@keyframes ${PULSE_CLASS} {
  0% { outline: 0 solid ${ACCENT_SOFT}; }
  40% { outline: 2px solid ${ACCENT_SOFT}; }
  100% { outline: 0 solid ${ACCENT_SOFT}; }
}
[${SELECTION_ATTR}].${PULSE_CLASS} { animation: ${PULSE_CLASS} 250ms ease-out; }
@media (prefers-reduced-motion: reduce) {
  [${SELECTION_ATTR}].${PULSE_CLASS} { animation: none; }
}`;

  return style;
}

function pulse(): void {
  const { box } = selectionPair();

  box.classList.remove(PULSE_CLASS);
  requestAnimationFrame(() => box.classList.add(PULSE_CLASS));
}

function drawn(depth: number): HTMLElement {
  const node = positioned(depth);

  node.style.boxSizing = "border-box";
  node.style.borderRadius = "2px";

  return node;
}

function tagged(depth: number): HTMLElement {
  const node = positioned(depth);

  node.style.background = ACCENT;
  node.style.color = LABEL_INK;
  node.style.borderRadius = "4px";
  node.style.padding = "2px 6px";
  node.style.font =
    "500 11px ui-sans-serif, system-ui, -apple-system, sans-serif";
  node.style.whiteSpace = "nowrap";

  return node;
}

function positioned(depth: number): HTMLElement {
  const node = document.createElement("div");

  node.setAttribute(OVERLAY_ATTR, "");
  node.style.position = "fixed";
  node.style.pointerEvents = "none";
  node.style.display = "none";
  node.style.left = "0";
  node.style.top = "0";
  node.style.zIndex = String(depth);

  return node;
}

function paint(): void {
  paintSelection();
  paintHover();
}

function paintSelection(): void {
  const { box, tag } = selectionPair();
  if (session?.inline.active()) {
    session.geometry.paint(null);
    place(box, tag, null);
    return;
  }
  const roots =
    managedSelected === null
      ? []
      : managedRoots(managedSelected.id).filter(
          (node) =>
            node.getAttribute("data-studio-video") === managedSelected?.video &&
            node.getAttribute("data-studio-generation") ===
              managedSelected?.generation
        );
  const root =
    (picked !== null && roots.includes(picked) ? picked : null) ??
    roots.find((node) => node.getBoundingClientRect().width > 0) ??
    null;
  const showing = managedSelected === null ? selected : root;
  place(box, tag, session?.geometry.paint(showing) ? null : showing);
}

function paintHover(): void {
  if (session === null) {
    return;
  }

  const isSelected =
    hovered !== null &&
    (hovered === selected ||
      (managedSelected !== null &&
        managedIdentity(hovered)?.objectId === managedSelected.id));
  place(
    session.box,
    session.label,
    isSelected || session.inline.active() || session.geometry.active()
      ? null
      : hovered
  );
  session.label.style.display = "none";
}

function place(
  box: HTMLElement,
  label: HTMLElement,
  showing: Element | null
): void {
  if (showing === null || !showing.isConnected) {
    box.style.display = "none";
    label.style.display = "none";
    return;
  }

  const rect = showing.getBoundingClientRect();

  box.style.display = "block";
  box.style.left = `${rect.left}px`;
  box.style.top = `${rect.top}px`;
  box.style.width = `${rect.width}px`;
  box.style.height = `${rect.height}px`;

  label.textContent = nameOf(showing);
  label.style.display = "block";
  label.style.left = `${Math.max(0, rect.left)}px`;
  label.style.top =
    rect.top > 20 ? `${rect.top - 19}px` : `${rect.bottom + 4}px`;
}

export function nameOf(element: Element): string {
  const managedLabel = element.getAttribute("data-studio-label");
  if (managedLabel !== null) {
    return managedLabel;
  }
  const tag = element.tagName.toLowerCase();
  const controls = controlsAt(element);
  const label =
    (controls === null
      ? null
      : nameIn(controls.currentRuntimeValueDotNotation)) ??
    componentAt(element) ??
    api?.getDisplayName(element) ??
    null;

  return label === null ? tag : `${plainName(label)} · ${tag}`;
}

/**
 * The name of the thing you are pointing at, which is the component you could
 * tune — not the machinery around it. Grab's own display name answers with
 * whatever fiber is nearest, and inside a Remotion tree that is routinely
 * `RegularSequenceRefForwardingFunction`: true, and useless to read.
 */
export function componentAt(element: Element): string | null {
  const controls = controlsAt(element);

  if (controls !== null) {
    return controls.componentName;
  }

  return nearestInFibers(element, (fiber) => {
    const name = displayName(fiber);

    return name !== null && !WRAPPERS.has(name) && !INTERNAL.test(name)
      ? name
      : null;
  });
}

async function report(
  element: Element,
  stage: Stage,
  repeat: boolean,
  version: number
): Promise<void> {
  const frame = stage.frame();
  const composition = stage.composition();
  const fps = stage.fps();
  const video = stage.video();
  const rect = normalise(element.getBoundingClientRect());
  const managed = managedIdentity(element);
  if (managed !== null) {
    post({ type: "studio.select", ...managed });
    return;
  }
  const module = grabModule();
  const found = grab();
  const root = rootPath();
  const container = canvas();
  const links = controlsChain(element);

  const [spot, frames, sources] = await Promise.all([
    found === null ? null : found.getSource(element).catch(nothing),
    module === null ? null : module.getStack(element).catch(nothing),
    Promise.all(
      links.map((link) =>
        found === null || link.node === null
          ? null
          : found.getSource(link.node).catch(nothing)
      )
    ),
  ]);

  if (version !== pickVersion || !element.isConnected) {
    return;
  }

  chain = new Map();

  for (const { controls, node } of links) {
    if (node === null) {
      continue;
    }

    if (container !== null) {
      chain.set(anchorOf(node, container), node);
    }

    chain.set(controls.overrideId, node);
  }

  const wheres = new Map<string, TargetWhere | null>();

  for (const [at, link] of links.entries()) {
    const where = whereOf(root, sources[at] ?? null);

    if (container !== null && link.node !== null) {
      wheres.set(anchorOf(link.node, container), where);
    }

    wheres.set(link.controls.overrideId, where);
  }

  const stack = projectFrames(root, frames);
  const target = resolved(root, spot) ?? stack.at(0) ?? null;
  const assets = await assetNames();

  if (version !== pickVersion || !element.isConnected) {
    return;
  }

  post({
    assetBase: assetBase(staticBase(), window.location.href),
    assets,
    element: {
      column: target?.column ?? null,
      component: spot?.componentName ?? target?.name ?? null,
      composition,
      file: target?.file ?? null,
      fps,
      frame,
      html: truncateMarkup(element.outerHTML, MARKUP_LIMIT),
      line: target?.line ?? null,
      scene: sceneOf(element, frame),
      stack: parentsOf(stack, target).map(formatFrame),
    },
    fonts: loadedFonts(),
    rect,
    repeat,
    text: directText(links.at(0)?.node ?? element),
    tuning: located(targetsOf(element), wheres),
    type: "selection",
    video,
    window: windowOf(element),
  });
}

function loadedFonts(): string[] {
  const faces = (document as { fonts?: Iterable<{ family?: unknown }> }).fonts;

  if (faces === undefined) {
    return [];
  }

  const families = new Set<string>();

  for (const face of faces) {
    if (typeof face.family === "string" && face.family.length > 0) {
      families.add(face.family);
    }
  }

  return [...families];
}

function directText(node: Element | null): string | null {
  if (node === null || node.childNodes.length !== 1) {
    return null;
  }

  const child = node.firstChild;
  const text =
    child?.nodeType === Node.TEXT_NODE ? (child.nodeValue ?? "") : "";

  return text.trim().length === 0 ? null : text;
}

function located(
  targets: readonly TuningTarget[],
  wheres: ReadonlyMap<string, TargetWhere | null>
): TuningTarget[] {
  return targets.map((target) => ({
    ...target,
    where: wheres.get(target.instanceId) ?? wheres.get(target.targetId) ?? null,
  }));
}

function whereOf(root: string, spot: GrabSource | null): TargetWhere | null {
  const found = resolved(root, spot);

  return found === null
    ? null
    : { column: found.column, file: found.file, line: found.line };
}

function resolved(root: string, spot: GrabSource | null): SourceSpot | null {
  const file = absolutise(root, spot?.filePath);

  return file === null || spot === null
    ? null
    : {
        column: spot.columnNumber,
        file,
        line: spot.lineNumber,
        name: spot.componentName,
      };
}

function parentsOf(
  stack: readonly SourceSpot[],
  target: SourceSpot | null
): SourceSpot[] {
  const first = stack.at(0);
  const rest =
    target !== null && first?.file === target.file && first.line === target.line
      ? stack.slice(1)
      : stack;

  return rest.slice(0, PARENTS);
}

function normalise(rect: DOMRect) {
  const width = window.innerWidth || 1;
  const height = window.innerHeight || 1;

  return {
    height: rect.height / height,
    width: rect.width / width,
    x: rect.left / width,
    y: rect.top / height,
  };
}

export function sceneOf(node: Element, frame: number): Scene | null {
  let fiber = fiberOf(node);
  let inner: string | null = null;

  while (fiber !== null) {
    const timing = sequenceTiming(fiber.memoizedProps);

    if (timing !== null) {
      return {
        ...timing,
        frame: frame - timing.from,
        name: labelOf(fiber.memoizedProps) ?? inner ?? "",
      };
    }

    const name = displayName(fiber);
    if (name !== null && !WRAPPERS.has(name)) {
      inner = name;
    }

    fiber = fiber.return;
  }

  return null;
}

function sequenceTiming(
  props: Record<string, unknown> | null
): { durationInFrames: number; from: number } | null {
  const from = props?.from;
  const durationInFrames = props?.durationInFrames;

  return typeof from === "number" &&
    Number.isFinite(from) &&
    typeof durationInFrames === "number" &&
    Number.isFinite(durationInFrames)
    ? {
        durationInFrames: Math.trunc(durationInFrames),
        from: Math.trunc(from),
      }
    : null;
}

function labelOf(props: Record<string, unknown> | null): string | null {
  const name = props?.name;
  return typeof name === "string" && name.length > 0 ? name : null;
}

function grabModule(): GrabModule | null {
  return (
    (globalThis as unknown as { __REACT_GRAB_MODULE__?: GrabModule })
      .__REACT_GRAB_MODULE__ ?? null
  );
}

function rootPath(): string {
  return (window as unknown as { remocn_root?: string }).remocn_root ?? "/";
}

const nothing = () => null;
