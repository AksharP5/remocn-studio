import { expect, it } from "bun:test";
import type { StudioField } from "@/shared/studio-document";
import {
  propertyGroup,
  propertyLabel,
  propertyTab,
  readableLabel,
} from "./property-presentation";

const field = (id: string, patch: Partial<StudioField> = {}): StudioField => ({
  default: 0,
  id,
  label: id,
  type: "number",
  ...patch,
});
it("makes generated labels readable without renaming authored captions or stored IDs", () => {
  const size = field("fontSize");
  expect(propertyLabel(size, [size])).toBe("Font size");
  expect(size.id).toBe("fontSize");
  expect(propertyLabel(field("width", { label: "Column width" }), [])).toBe(
    "Column width"
  );
  expect(propertyLabel(field("customOffset"), [])).toBe("Custom Offset");
  expect(readableLabel("easeInOut")).toBe("Ease In Out");
});
it("uses object context for color and preserves custom groups", () => {
  expect(propertyLabel(field("color"), [field("text")])).toBe("Text color");
  expect(propertyLabel(field("color"), [])).toBe("Color");
  expect(propertyGroup(field("custom", { group: "Camera optics" }))).toBe(
    "Camera optics"
  );
});
it("routes motion, physics and timing without losing unknown properties", () => {
  for (const id of ["spring", "damping", "entryDuration", "exitEasing"]) {
    expect(propertyTab(field(id))).toBe("animation");
  }
  expect(propertyTab(field("custom", { group: "Motion" }))).toBe("animation");
  expect(propertyTab(field("end", { unit: "s" }))).toBe("animation");
  expect(propertyTab(field("custom"))).toBe("appearance");
});
