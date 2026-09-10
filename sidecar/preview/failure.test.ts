import { describe, expect, it } from "bun:test";
import {
  diagnoseRender,
  explainRender,
  type RenderContext,
  UNKNOWN_CONTEXT,
} from "./failure";

const ANGLE: RenderContext = {
  gl: "angle",
  glSource: "studio",
  support: "webgl2",
};

const NO_GL: RenderContext = {
  gl: null,
  glSource: "default",
  support: "none",
};

const kindOf = (message: string, context = UNKNOWN_CONTEXT) =>
  diagnoseRender(message, context).kind;

describe("diagnoseRender", () => {
  it("knows a context that was never created", () => {
    expect(kindOf('canvas.getContext("webgl2") returned null')).toBe(
      "gl-unavailable"
    );
    expect(kindOf("THREE.WebGLRenderer: Error creating WebGL context.")).toBe(
      "gl-unavailable"
    );
    expect(kindOf("WebGL is not supported in this browser")).toBe(
      "gl-unavailable"
    );
  });

  it("keeps a lost context apart from one that never existed", () => {
    expect(kindOf("WebGL context was lost")).toBe("gl-lost");
    expect(kindOf("CONTEXT_LOST_WEBGL")).toBe("gl-lost");
  });

  it("knows the browser dying from the scene failing", () => {
    expect(kindOf("Target closed")).toBe("crash");
    expect(kindOf("Protocol error (Page.navigate): Session closed.")).toBe(
      "crash"
    );
  });

  it("no longer calls every delayRender() a WebGL problem", () => {
    const message =
      "A delayRender() was called but not cleared after 30000ms\nFailed to fetch https://fonts.example/Inter.woff2";

    expect(kindOf(message)).toBe("stuck");
    expect(diagnoseRender(message, ANGLE).hint).toContain("font");
    expect(diagnoseRender(message, ANGLE).hint).not.toContain(
      "never finishes compiling"
    );
  });

  it("says the GL sentence for a stuck render only when GL really is missing", () => {
    const message = "A delayRender() was called but not cleared after 30000ms";

    expect(diagnoseRender(message, NO_GL).hint).toContain(
      "could not make a WebGL context"
    );
    expect(diagnoseRender(message, ANGLE).hint).toContain("webgl2");
  });

  it("names the project when the backend was the project's own choice", () => {
    const said = diagnoseRender('canvas.getContext("webgl") returned null', {
      gl: "swiftshader",
      glSource: "config",
      support: "none",
    }).hint;

    expect(said).toContain("swiftshader");
    expect(said).toContain("the project's own");
  });

  it("offers to change the backend when the studio chose it", () => {
    const said = diagnoseRender("Could not create a WebGL context", ANGLE).hint;

    expect(said).toContain("setChromiumOpenGlRenderer");
    expect(said).not.toContain("the project's own");
  });

  it("knows a missing file", () => {
    expect(kindOf("Error: ENOENT: no such file or directory")).toBe("asset");
    expect(kindOf("net::ERR_CONNECTION_REFUSED")).toBe("asset");
  });

  it("knows the encoder", () => {
    expect(kindOf("ffmpeg exited with code 1")).toBe("encoder");
  });

  it("knows the scene's own code", () => {
    expect(kindOf("TypeError: value.map is not a function")).toBe("javascript");
  });

  it("says nothing it cannot stand behind", () => {
    const said = diagnoseRender("something went wrong");

    expect(said.kind).toBe("unknown");
    expect(said.hint).toBeNull();
  });
});

describe("explainRender", () => {
  it("keeps the raw failure and adds the reading under it", () => {
    const raw = 'canvas.getContext("webgl2") returned null';
    const said = explainRender(raw, ANGLE);

    expect(said.startsWith(raw)).toBe(true);
    expect(said.length).toBeGreaterThan(raw.length);
  });

  it("leaves a message it cannot read alone", () => {
    expect(explainRender("something went wrong")).toBe("something went wrong");
  });
});
