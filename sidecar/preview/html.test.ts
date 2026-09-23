import { describe, expect, it } from "bun:test";
import { renderPage } from "./html";

describe("renderPage", () => {
  const rendered = () =>
    renderPage({
      publicPath: "/",
      staticBase: "/static-abc123",
      title: "demo",
      version: "4.0.481",
    });

  it("renders the element the render entry reads at module scope", () => {
    expect(rendered()).toContain('id="video-container"');
  });

  it("declares the site version the renderer refuses a page without", () => {
    expect(rendered()).toContain('window.siteVersion = "11";');
  });

  it("declares the Remotion version the bundle was built against", () => {
    expect(rendered()).toContain('window.remotion_version = "4.0.481";');
  });

  it("leaves the timeout to the renderer, which sets its own", () => {
    expect(rendered()).not.toContain("remotion_puppeteerTimeout");
  });

  it("declares production, which is what makes Remotion render rather than idle", () => {
    expect(rendered()).toContain(
      'window.process = {"env":{"NODE_ENV":"production"}};'
    );
  });

  it("hands over no env variables, so nothing overwrites that NODE_ENV", () => {
    expect(rendered()).toContain('window.remotion_envVariables = "";');
  });

  it("keeps the player out, since nothing headless should mount one", () => {
    expect(rendered()).not.toContain('id="__remotion-studio-container"');
  });

  it("loads grab nowhere near a render", () => {
    expect(rendered()).not.toContain("/__remocn/grab.js");
  });

  it("loads the bundle relative to itself, so its sourcemap resolves too", () => {
    expect(rendered()).toContain('<script src="bundle.js"></script>');
  });

  it("publishes the static base staticFile() reads", () => {
    expect(rendered()).toContain(
      'window.remotion_staticBase = "/static-abc123";'
    );
  });
});
