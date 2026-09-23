import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { waitFor } from "@testing-library/react";
import { presentObjects, watchPresence } from "./presence";

function object(id: string): HTMLDivElement {
  const element = document.createElement("div");
  element.setAttribute("data-studio-object", id);
  return element;
}

function frame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

describe("presentObjects", () => {
  it("lists each mounted object once, sorted", () => {
    const root = document.createElement("div");
    const card = object("card");
    card.append(object("price"), object("price"));
    root.append(object("title"), card);

    expect(presentObjects(root)).toEqual(["card", "price", "title"]);
  });
});

describe("watchPresence", () => {
  let root: HTMLDivElement;
  let stop: () => void;
  const report = mock();

  beforeEach(() => {
    report.mockReset();
    root = document.createElement("div");
    document.body.append(root);
  });

  afterEach(() => {
    stop();
    root.remove();
  });

  it("reports what is mounted when it starts", () => {
    root.append(object("title"));
    stop = watchPresence(root, report);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenLastCalledWith(["title"]);
  });

  it("reports a mount and an unmount once each", async () => {
    stop = watchPresence(root, report);
    const title = object("title");
    root.append(title);
    root.append(document.createElement("span"));

    await waitFor(() => expect(report).toHaveBeenCalledTimes(2));
    expect(report).toHaveBeenLastCalledWith(["title"]);

    title.remove();
    await waitFor(() => expect(report).toHaveBeenCalledTimes(3));
    expect(report).toHaveBeenLastCalledWith([]);
  });

  it("stays quiet when the DOM changes but the objects do not", async () => {
    root.append(object("title"));
    stop = watchPresence(root, report);
    const counter = document.createElement("span");
    root.append(counter);
    counter.remove();
    await frame();
    await frame();

    expect(report).toHaveBeenCalledTimes(1);
  });
});
