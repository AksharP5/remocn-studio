import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { releaseDetachedMedia } from "./media-release";

// jsdom implements neither, and both are the whole point: `load()` on an
// element with no source is what makes WebKit drop the player.
const loads = vi.fn();
const pauses = vi.fn();

function settle() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function video(src: string): HTMLVideoElement {
  const element = document.createElement("video");
  element.setAttribute("src", src);
  return element;
}

describe("releaseDetachedMedia", () => {
  let container: HTMLDivElement;
  let stop: () => void;

  beforeEach(() => {
    loads.mockReset();
    pauses.mockReset();
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(loads);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pauses);
    container = document.createElement("div");
    document.body.append(container);
    stop = releaseDetachedMedia(container);
  });

  afterEach(() => {
    stop();
    container.remove();
    vi.restoreAllMocks();
  });

  it("clears and reloads a video the scene unmounted", async () => {
    const scene = document.createElement("div");
    const clip = video("/library/clip.mp4");
    scene.append(clip);
    container.append(scene);
    await settle();

    scene.remove();
    await settle();

    expect(clip.hasAttribute("src")).toBe(false);
    expect(pauses).toHaveBeenCalledTimes(1);
    expect(loads).toHaveBeenCalledTimes(1);
  });

  it("releases a video removed on its own, and audio too", async () => {
    const clip = video("/library/clip.mp4");
    const sound = document.createElement("audio");
    sound.setAttribute("src", "/library/beat.mp3");
    container.append(clip, sound);
    await settle();

    clip.remove();
    sound.remove();
    await settle();

    expect(clip.hasAttribute("src")).toBe(false);
    expect(sound.hasAttribute("src")).toBe(false);
    expect(loads).toHaveBeenCalledTimes(2);
  });

  // React moves a node by removing and re-inserting it in one commit. That is
  // not an unmount, and a clip released there would go dark on screen.
  it("leaves a video alone that was moved rather than removed", async () => {
    const clip = video("/library/clip.mp4");
    const before = document.createElement("div");
    const after = document.createElement("div");
    container.append(before, after);
    before.append(clip);
    await settle();

    clip.remove();
    after.append(clip);
    await settle();

    expect(clip.getAttribute("src")).toBe("/library/clip.mp4");
    expect(loads).not.toHaveBeenCalled();
  });

  it("stops watching once disconnected", async () => {
    stop();
    const clip = video("/library/clip.mp4");
    container.append(clip);
    await settle();

    clip.remove();
    await settle();

    expect(clip.getAttribute("src")).toBe("/library/clip.mp4");
    stop = () => undefined;
  });
});
