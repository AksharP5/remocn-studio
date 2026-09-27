import { describe, expect, it } from "bun:test";
import {
  configureSurface,
  contentRoot,
  focusSurface,
  lockCamera,
  nativeSurface,
  overlayRoot,
  styleRoot,
  surfaceHref,
} from "./surface";

function environment() {
  const host = document.createElement("div");
  const root = host.attachShadow({ mode: "open" });
  const viewport = document.createElement("div");
  const overlays = document.createElement("div");
  overlays.append(document.createElement("span"));
  return {
    assets: "http://127.0.0.1/assets/",
    composition: "intro",
    getStack: async () => null,
    overlays,
    preferred: null,
    project: "demo",
    root,
    url: "http://127.0.0.1/video",
    viewport,
  };
}

describe("configureSurface", () => {
  it("falls back to the document and window before any surface configures", () => {
    expect(nativeSurface()).toBeNull();
    expect(contentRoot()).toBe(document);
    expect(overlayRoot()).toBe(document.body);
    expect(styleRoot()).toBe(document.head);
    expect(surfaceHref()).toBe(window.location.href);
  });

  it("installs the environment so accessors read the native surface", () => {
    const value = environment();
    const dispose = configureSurface(value);

    expect(nativeSurface()).toBe(value);
    expect(contentRoot()).toBe(value.root);
    expect(overlayRoot()).toBe(value.overlays);
    expect(styleRoot()).toBe(value.root);
    expect(surfaceHref()).toBe(value.url);

    dispose();
  });

  it("focuses the surface viewport while configured, the window once torn down", () => {
    const value = environment();
    const dispose = configureSurface(value);
    let viewportFocused = false;
    value.viewport.focus = () => {
      viewportFocused = true;
    };

    focusSurface();
    expect(viewportFocused).toBe(true);

    dispose();
    let windowFocused = false;
    const original = window.focus;
    window.focus = () => {
      windowFocused = true;
    };
    focusSurface();
    window.focus = original;
    expect(windowFocused).toBe(true);
  });

  it("marks the viewport as editing while any lock is held, and clears it once all release", () => {
    const value = environment();
    const dispose = configureSurface(value);
    const first = {};
    const second = {};

    lockCamera(first, true);
    expect(value.viewport.hasAttribute("data-preview-editing")).toBe(true);

    lockCamera(second, true);
    lockCamera(first, false);
    expect(value.viewport.hasAttribute("data-preview-editing")).toBe(true);

    lockCamera(second, false);
    expect(value.viewport.hasAttribute("data-preview-editing")).toBe(false);

    dispose();
  });

  it("cancels an unfinished edit lock when the runtime is torn down", () => {
    const value = environment();
    const dispose = configureSurface(value);
    lockCamera({}, true);
    expect(value.viewport.hasAttribute("data-preview-editing")).toBe(true);

    dispose();

    expect(value.viewport.hasAttribute("data-preview-editing")).toBe(false);
    // A lock held by the torn-down surface must not resurrect on the next one.
    const next = environment();
    const disposeNext = configureSurface(next);
    lockCamera({}, false);
    expect(next.viewport.hasAttribute("data-preview-editing")).toBe(false);
    disposeNext();
  });

  it("clears the overlay layer's children when the runtime is torn down", () => {
    const value = environment();
    const dispose = configureSurface(value);
    expect(value.overlays.childElementCount).toBe(1);

    dispose();

    expect(value.overlays.childElementCount).toBe(0);
  });

  it("returns accessors to their fallback once the surface disconnects", () => {
    const value = environment();
    const dispose = configureSurface(value);

    dispose();

    expect(nativeSurface()).toBeNull();
    expect(contentRoot()).toBe(document);
    expect(overlayRoot()).toBe(document.body);
    expect(surfaceHref()).toBe(window.location.href);
  });
});
