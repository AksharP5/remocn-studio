import type { StudioField } from "@/shared/studio-document";

export type PropertyTab = "appearance" | "animation";
const CAMEL = /([a-z0-9])([A-Z])/g;
const SEPARATORS = /[_-]+/g;
const MOTION_GROUP =
  /^(motion|animation|entry|exit|timing|spring|physics)(\b|[._-])/i;
const MOTION_FIELD =
  /^(entry|exit|spring|animation|transition)[A-Z_.-]|^(spring|easing|damping|stiffness|mass|words|delay|duration)$/;
const LABELS: Record<string, string> = {
  align: "Alignment",
  damping: "Damping",
  easing: "Easing",
  end: "End time",
  entryDistance: "Entry distance",
  entryDuration: "Entry duration",
  entryEasing: "Entry easing",
  entryFrames: "Entry duration",
  exitDuration: "Exit duration",
  exitEasing: "Exit easing",
  exitFrames: "Exit duration",
  fill: "Background color",
  fontSize: "Font size",
  fontWeight: "Font weight",
  height: "Height",
  letterSpacing: "Letter spacing",
  lineHeight: "Line height",
  mass: "Mass",
  opacity: "Opacity",
  padding: "Padding",
  radius: "Corner radius",
  spring: "Use spring",
  start: "Start time",
  stiffness: "Stiffness",
  width: "Width",
  words: "Animate by word",
  x: "X",
  y: "Y",
};
const GROUPS: Record<string, string> = {
  Fill: "Colors",
  Layout: "Layout",
  Motion: "Motion",
  Properties: "Properties",
  Typography: "Text",
};
export function readableLabel(label: string): string {
  const words = label.replace(CAMEL, "$1 $2").replace(SEPARATORS, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
export function propertyLabel(
  field: StudioField,
  fields: readonly StudioField[]
): string {
  if (field.label !== field.id) {
    return field.label;
  }
  if (field.id === "color") {
    return fields.some((item) => item.id === "text") ? "Text color" : "Color";
  }
  return LABELS[field.id] ?? readableLabel(field.label);
}
export function propertyTab(field: StudioField): PropertyTab {
  return field.type === "easing" ||
    MOTION_GROUP.test(field.group ?? "") ||
    MOTION_FIELD.test(field.id) ||
    field.unit === "s" ||
    field.unit === "frames"
    ? "animation"
    : "appearance";
}
export function propertyGroup(field: StudioField): string {
  if (field.group?.trim()) {
    return field.group.trim();
  }
  if (propertyTab(field) === "animation") {
    return "Motion";
  }
  if (
    [
      "text",
      "fontSize",
      "fontWeight",
      "letterSpacing",
      "lineHeight",
      "align",
    ].includes(field.id)
  ) {
    return "Typography";
  }
  if (field.type === "color" || field.id === "opacity") {
    return "Fill";
  }
  if (["x", "y", "width", "height", "radius", "padding"].includes(field.id)) {
    return "Layout";
  }
  return "Properties";
}
export function propertyGroupLabel(group: string): string {
  return GROUPS[group] ?? readableLabel(group);
}
