import { afterEach, describe, expect, it } from "bun:test";
import { hide, reveal, revealAll } from "./hidden";

afterEach(() => {
  revealAll();
  document.body.replaceChildren();
});

function mount(id: string) {
  const root = document.createElement("h1");
  root.setAttribute("data-studio-object", id);
  root.textContent = id;
  document.body.append(root);
  return root;
}

describe("hiding before a deletion is saved", () => {
  it("hides the object and keeps it hidden when it is drawn again", () => {
    const first = mount("subtitle");
    hide("remove-1", ['[data-studio-object="subtitle"]']);
    expect(getComputedStyle(first).display).toBe("none");
    first.remove();
    const again = mount("subtitle");
    expect(getComputedStyle(again).display).toBe("none");
  });

  it("shows it again when the hide is withdrawn, and leaves others alone", () => {
    const subtitle = mount("subtitle");
    const title = mount("title");
    hide("remove-1", ['[data-studio-object="subtitle"]']);
    expect(getComputedStyle(title).display).not.toBe("none");
    reveal("remove-1");
    expect(getComputedStyle(subtitle).display).not.toBe("none");
    expect(document.querySelector("style[data-studio-hidden]")).toBeNull();
  });
});
