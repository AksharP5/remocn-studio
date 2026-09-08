import { describe, expect, it } from "bun:test";
import {
  ASSET_IS_A_CALL,
  COMPUTED_IN_CODE,
  FONT_NOT_LOADED,
  isTypeScriptFile,
  NO_CALL_SITE,
  NO_STATUS,
  NOT_TYPESCRIPT,
  routeOf,
} from "./codemod";

const TSX = "/videos/promo/src/videos/intro/Title.tsx";

function route(overrides: Partial<Parameters<typeof routeOf>[0]> = {}) {
  return routeOf({
    file: TSX,
    fonts: [],
    kind: "static",
    type: "number",
    value: 48,
    writable: true,
    ...overrides,
  });
}

describe("what the studio may write", () => {
  it("takes a static value at a call site", () => {
    expect(route()).toEqual({ reason: null, route: "code" });
  });

  // The codemod reads JSX attributes and never a schema default, so a prop
  // with no attribute is still `static` — it is added rather than replaced.
  it("takes a static value whose call site carries no attribute yet", () => {
    expect(route({ kind: "static" }).route).toBe("code");
  });

  it("takes a keyframed value, which becomes a keyframe rather than a constant", () => {
    expect(route({ kind: "keyframed" }).route).toBe("code");
  });

  it("hands a computed value to the agent", () => {
    expect(route({ kind: "computed" })).toEqual({
      reason: COMPUTED_IN_CODE,
      route: "agent",
    });
  });

  it("hands over an element the codemod could not find", () => {
    expect(route({ writable: false })).toEqual({
      reason: NO_CALL_SITE,
      route: "agent",
    });
  });

  it("hands over a key nothing answered a status for", () => {
    expect(route({ kind: null })).toEqual({
      reason: NO_STATUS,
      route: "agent",
    });
  });

  it("refuses a file that is not TypeScript before anything else", () => {
    expect(route({ file: "/videos/promo/src/Title.jsx" })).toEqual({
      reason: NOT_TYPESCRIPT,
      route: "agent",
    });
  });
});

describe("a font family", () => {
  it("is written when the preview has the family loaded", () => {
    expect(
      route({
        fonts: ["Inter", "Geist Mono"],
        type: "font-family",
        value: "Inter",
      }).route
    ).toBe("code");
  });

  it("reads a quoted stack, and every family in it has to be loaded", () => {
    expect(
      route({
        fonts: ["Inter", "sans-serif"],
        type: "font-family",
        value: '"Inter", sans-serif',
      }).route
    ).toBe("code");

    expect(
      route({
        fonts: ["Inter"],
        type: "font-family",
        value: '"Inter", "Playfair Display"',
      })
    ).toEqual({ reason: FONT_NOT_LOADED, route: "agent" });
  });

  // Naming a family the preview never loaded would write a line that renders
  // as the fallback and say nothing about it. The import is the agent's job.
  it("goes to the agent when the family is not loaded", () => {
    expect(
      route({ fonts: [], type: "font-family", value: "Playfair Display" })
    ).toEqual({ reason: FONT_NOT_LOADED, route: "agent" });
  });

  // The pane holds an asset as the name of a file in `public/`; the file holds
  // the call that resolves it. Writing the name over the call would leave a
  // string nothing serves.
  it("goes to the agent for a picture, even at a literal src", () => {
    expect(route({ type: "asset", value: "library/logo.png" })).toEqual({
      reason: ASSET_IS_A_CALL,
      route: "agent",
    });
  });
});

describe("which files the codemod parses", () => {
  it("is Remotion's own list, reimplemented because it is not exported", () => {
    for (const file of ["a.ts", "a.tsx", "a.mts", "a.mtsx"]) {
      expect(isTypeScriptFile(file)).toBe(true);
    }

    for (const file of ["a.js", "a.jsx", "a.mjs", "a.tsxx", "Title"]) {
      expect(isTypeScriptFile(file)).toBe(false);
    }
  });
});
