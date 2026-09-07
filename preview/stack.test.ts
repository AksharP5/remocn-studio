import { describe, expect, it } from "vitest";
import { originOf } from "./stack";

const ROOT = "/Users/me/projects/promo";

// What `@remotion/bundler`'s `setup-sequence-stack-traces` writes when
// `jsxDEV` hands it a source location — the file percent-encoded, the line and
// the column after it.
function stackFor(file: string, line = 24, column = 7): string {
  return `Error\n    at remotionOriginalSource (studio-original://${encodeURIComponent(
    file
  )}:${line}:${column})`;
}

describe("the call site behind an element's controls", () => {
  it("reads an absolute file out of Remotion's own stack", () => {
    expect(
      originOf(ROOT, stackFor(`${ROOT}/src/videos/intro/Title.tsx`))
    ).toEqual({
      column: 7,
      file: `${ROOT}/src/videos/intro/Title.tsx`,
      line: 24,
    });
  });

  it("settles a relative one against the root the page carries", () => {
    expect(
      originOf(ROOT, stackFor("./src/videos/intro/Title.tsx", 40, 3))
    ).toEqual({
      column: 3,
      file: `${ROOT}/src/videos/intro/Title.tsx`,
      line: 40,
    });
  });

  it("decodes a path with a space in it", () => {
    expect(
      originOf(ROOT, stackFor(`${ROOT}/src/My Videos/Title.tsx`))?.file
    ).toBe(`${ROOT}/src/My Videos/Title.tsx`);
  });

  // A production build gets no source argument, so the stack is an ordinary
  // `new Error().stack` and names nothing the codemod could use.
  it("answers nothing for a stack with no original source in it", () => {
    expect(
      originOf(
        ROOT,
        "Error\n    at Object.jsx (http://127.0.0.1:3000/bundle.js:1:2)"
      )
    ).toBeNull();
    expect(originOf(ROOT, null)).toBeNull();
    expect(originOf(ROOT, undefined)).toBeNull();
  });
});
