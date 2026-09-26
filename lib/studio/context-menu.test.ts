import { describe, expect, it } from "bun:test";
import { keepsNativeMenu } from "@/lib/studio/context-menu";

function inside(html: string, selector: string): Element {
  document.body.innerHTML = html;
  const found = document.querySelector(selector);
  if (found === null) {
    throw new Error(`nothing matches ${selector}`);
  }
  return found;
}

describe("keepsNativeMenu", () => {
  it("keeps the webview's menu in text the person can edit or select", () => {
    expect(keepsNativeMenu(inside("<input />", "input"))).toBe(true);
    expect(keepsNativeMenu(inside("<textarea></textarea>", "textarea"))).toBe(
      true
    );
    expect(
      keepsNativeMenu(inside('<div contenteditable="true"></div>', "div"))
    ).toBe(true);
  });

  it("keeps it over the transcript only while text in it is selected", () => {
    const target = inside(
      '<div data-selectable><p id="t">some words</p></div><p id="o">elsewhere</p>',
      "#t"
    );
    const selection = document.getSelection();
    selection?.removeAllRanges();

    expect(keepsNativeMenu(target, selection)).toBe(false);

    const words = target.firstChild;
    if (words === null) {
      throw new Error("the paragraph has no text");
    }
    selection?.setBaseAndExtent(words, 0, words, 4);

    expect(keepsNativeMenu(target, selection)).toBe(true);

    const other = document.querySelector("#o")?.firstChild ?? null;
    if (other === null) {
      throw new Error("the other paragraph has no text");
    }
    selection?.setBaseAndExtent(other, 0, other, 4);

    expect(keepsNativeMenu(target, selection)).toBe(false);
    selection?.removeAllRanges();
  });

  it("suppresses it everywhere else", () => {
    expect(keepsNativeMenu(inside("<button>Go</button>", "button"))).toBe(
      false
    );
    expect(keepsNativeMenu(null)).toBe(false);
  });
});
