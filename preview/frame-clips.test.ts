import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { releaseFrameClips } from "./frame-clips";

const MOVING = "data-remocn-moving";

function settle() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe("releaseFrameClips", () => {
  let host: HTMLDivElement;
  let root: ShadowRoot;
  let element: HTMLDivElement;
  let player: HTMLDivElement;
  let stop: () => void;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = host.attachShadow({ mode: "open" });
    element = document.createElement("div");
    player = document.createElement("div");
    player.className = "__remotion-player";
    element.append(player);
    root.append(element);
    stop = releaseFrameClips(root, element);
  });

  afterEach(() => {
    stop();
    host.remove();
  });

  function child(): HTMLDivElement {
    const node = document.createElement("div");
    player.append(node);
    return node;
  }

  it("composites an element whose transform changes from frame to frame", async () => {
    const strip = child();
    strip.style.transform = "translateX(-10%)";
    await settle();
    expect(strip.hasAttribute(MOVING)).toBe(false);

    strip.style.transform = "translateX(-12%)";
    await settle();

    expect(strip.hasAttribute(MOVING)).toBe(true);
    expect(root.querySelector("style")?.textContent).toContain(
      `[${MOVING}] { will-change: transform; }`
    );
  });

  it("leaves an element alone when only something other than its transform changes", async () => {
    const centred = child();
    centred.style.transform = "translate(-50%, -50%)";
    await settle();

    centred.style.opacity = "0.4";
    await settle();
    centred.style.opacity = "0.8";
    await settle();

    expect(centred.hasAttribute(MOVING)).toBe(false);
  });

  it("stops compositing an element once its transform is gone", async () => {
    const strip = child();
    strip.style.transform = "scale(0.5)";
    await settle();
    strip.style.transform = "scale(0.6)";
    await settle();
    expect(strip.hasAttribute(MOVING)).toBe(true);

    strip.style.transform = "none";
    await settle();
    expect(strip.hasAttribute(MOVING)).toBe(false);

    strip.style.transform = "scale(0.7)";
    await settle();
    expect(strip.hasAttribute(MOVING)).toBe(true);

    strip.style.removeProperty("transform");
    await settle();
    expect(strip.hasAttribute(MOVING)).toBe(false);
  });

  it("does not composite the player's own scaled container or an inline element", async () => {
    player.style.transform = "scale(0.5)";
    await settle();
    player.style.transform = "scale(1)";

    const word = document.createElement("span");
    word.style.display = "inline";
    player.append(word);
    word.style.transform = "translateY(2px)";
    await settle();
    word.style.transform = "translateY(4px)";
    await settle();

    expect(player.hasAttribute(MOVING)).toBe(false);
    expect(word.hasAttribute(MOVING)).toBe(false);
  });

  it("stops watching and drops its stylesheet when released", async () => {
    const strip = child();
    strip.style.transform = "translateX(0%)";
    await settle();
    stop();

    strip.style.transform = "translateX(5%)";
    await settle();

    expect(strip.hasAttribute(MOVING)).toBe(false);
    expect(root.querySelector("style")).toBeNull();
  });
});
