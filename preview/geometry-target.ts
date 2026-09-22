import {
  GEOMETRY_KEYS,
  IDENTITY_GEOMETRY_POSE,
  type GeometryBinding,
  type GeometryKey,
  type GeometryPose,
  type GeometryValues,
  poseGeometry,
} from "../shared/studio-geometry";
import type { PreviewCommand } from "./bridge";
import { managedIdentity } from "./managed-objects";

export type GeometryConfig = Extract<
  PreviewCommand,
  { type: "studio.geometry.config" }
>;
export interface GeometryTarget {
  binding: GeometryBinding;
  bindingAttribute: string;
  bounds: Partial<
    Record<GeometryKey, { min: number | null; max: number | null }>
  >;
  generation: string;
  node: HTMLElement;
  objectId: string;
  parentScale: number;
  parentRotation: number;
  pose: GeometryPose;
  poseAttribute: string | null;
  frameAttribute: string | null;
  scale: number;
  values: GeometryValues;
  video: string;
}

export function geometryTarget(
  node: Element | null,
  config: GeometryConfig | null
): GeometryTarget | null {
  if (
    !(node instanceof HTMLElement) ||
    !config ||
    !node.isConnected ||
    node.getClientRects().length !== 1
  )
    return null;
  const identity = managedIdentity(node);
  if (
    !identity ||
    identity.objectId !== config.objectId ||
    identity.generation !== config.generation ||
    identity.video !== config.video
  )
    return null;
  let binding: GeometryBinding;
  let pose: GeometryPose;
  const poseAttribute = node.getAttribute("data-studio-geometry-pose");
  const bindingAttribute = node.getAttribute("data-studio-geometry") ?? "null";
  try {
    const parsed = JSON.parse(bindingAttribute);
    if (
      !parsed ||
      GEOMETRY_KEYS.some((key) =>
        key === "rotation" && parsed[key] === null
          ? false
          : typeof parsed[key] !== "string"
      )
    )
      return null;
    binding = parsed;
    pose =
      poseAttribute === null
        ? IDENTITY_GEOMETRY_POSE
        : JSON.parse(poseAttribute);
    if (
      !pose ||
      !Number.isFinite(pose.scale) ||
      pose.scale <= 0 ||
      GEOMETRY_KEYS.some(
        (key) =>
          !Number.isFinite(pose.multiplier?.[key]) ||
          pose.multiplier[key] < 0.000001 ||
          !Number.isFinite(pose.offset?.[key])
      )
    )
      return null;
  } catch {
    return null;
  }
  const ids = Object.values(binding).filter((id) => id !== null);
  if (new Set(ids).size !== ids.length) return null;
  const values: GeometryValues = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
  };
  const bounds: GeometryTarget["bounds"] = {};
  for (const key of GEOMETRY_KEYS) {
    const id = binding[key];
    if (id === null) continue;
    const field = config.fields.find((item) => item.id === id);
    if (!field || !Number.isFinite(field.value)) return null;
    values[key] = field.value;
    bounds[key] = { min: field.min, max: field.max };
  }
  if (values.width < 1 || values.height < 1 || !renderedGeometry(node, values))
    return null;
  const rendered = poseGeometry(values, pose);
  if (
    rendered.width < 1 ||
    rendered.height < 1 ||
    !GEOMETRY_KEYS.every((key) => Number.isFinite(rendered[key]))
  )
    return null;
  const style = getComputedStyle(node);
  const local = similarity(style.transform);
  if (
    style.position !== "absolute" ||
    style.boxSizing !== "border-box" ||
    !close(uniformScale(style.scale), pose.scale) ||
    style.perspective !== "none" ||
    !local ||
    !close(local.scale, 1) ||
    !close(local.rotation, 0) ||
    (style.transform !== "none" && !identityTranslation(style.transform)) ||
    style.visibility !== "visible" ||
    Number(style.opacity) < 0.05
  )
    return null;
  if (
    !close(Number.parseFloat(style.left), rendered.x, 0.03) ||
    !close(Number.parseFloat(style.top), rendered.y, 0.03) ||
    !close(Number.parseFloat(style.width), rendered.width, 0.03) ||
    !close(Number.parseFloat(style.height), rendered.height, 0.03) ||
    !close(degrees(style.rotate), rendered.rotation)
  )
    return null;
  const origin = style.transformOrigin.split(" ").map(Number.parseFloat);
  if (
    !close(origin[0], rendered.width / 2, 0.03) ||
    !close(origin[1], rendered.height / 2, 0.03)
  )
    return null;

  let parentScale = 1;
  let parentRotation = 0;
  for (
    let parent: HTMLElement | null = node.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    const inherited = getComputedStyle(parent);
    if (
      inherited.perspective !== "none" ||
      inherited.visibility !== "visible" ||
      Number(inherited.opacity) < 0.05
    )
      return null;
    const matrix = similarity(inherited.transform);
    const rotation = degrees(inherited.rotate);
    const scale = uniformScale(inherited.scale);
    if (!matrix || !Number.isFinite(rotation) || !Number.isFinite(scale))
      return null;
    parentScale *= matrix.scale * scale;
    parentRotation += matrix.rotation + rotation;
    const zoom = Number.parseFloat(inherited.zoom);
    if (Number.isFinite(zoom))
      parentScale *= inherited.zoom.endsWith("%") ? zoom / 100 : zoom;
  }
  const scale = parentScale * pose.scale;
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const angle = ((rendered.rotation + parentRotation) * Math.PI) / 180;
  const rect = node.getBoundingClientRect();
  const expectedWidth =
    (Math.abs(Math.cos(angle)) * rendered.width +
      Math.abs(Math.sin(angle)) * rendered.height) *
    scale;
  const expectedHeight =
    (Math.abs(Math.sin(angle)) * rendered.width +
      Math.abs(Math.cos(angle)) * rendered.height) *
    scale;
  if (
    !close(rect.width, expectedWidth, 0.25) ||
    !close(rect.height, expectedHeight, 0.25)
  )
    return null;
  return {
    ...identity,
    binding,
    bindingAttribute,
    bounds,
    node,
    parentScale,
    parentRotation,
    pose,
    poseAttribute,
    frameAttribute: node.getAttribute("data-studio-geometry-frame"),
    scale,
    values,
  };
}

export function renderedGeometry(
  node: HTMLElement,
  values: GeometryValues
): boolean {
  try {
    const rendered = JSON.parse(
      node.getAttribute("data-studio-geometry-values") ?? "null"
    );
    return (
      rendered !== null &&
      GEOMETRY_KEYS.every((key) => close(rendered[key], values[key], 0.000001))
    );
  } catch {
    return false;
  }
}

function similarity(
  transform: string
): { scale: number; rotation: number } | null {
  if (transform === "none") return { scale: 1, rotation: 0 };
  const matrix = new DOMMatrixReadOnly(transform);
  const scale = Math.hypot(matrix.a, matrix.b);
  if (
    !matrix.is2D ||
    scale <= 0 ||
    !close(matrix.a, matrix.d) ||
    !close(matrix.b, -matrix.c)
  )
    return null;
  return { scale, rotation: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI };
}
function identityTranslation(transform: string): boolean {
  const matrix = new DOMMatrixReadOnly(transform);
  return close(matrix.e, 0) && close(matrix.f, 0);
}
function uniformScale(value: string): number {
  if (value === "none") return 1;
  const axes = value.split(" ").map(Number);
  return axes[0] > 0 &&
    axes.length <= 2 &&
    (axes.length === 1 || close(axes[0], axes[1]))
    ? axes[0]
    : Number.NaN;
}
function degrees(value: string): number {
  if (value === "none") return 0;
  if (!/^-?[\d.]+deg$/.test(value)) return Number.NaN;
  return Number.parseFloat(value);
}
function close(a: number, b: number, epsilon = 0.000001): boolean {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= epsilon;
}
