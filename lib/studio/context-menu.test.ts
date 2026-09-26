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
      keepsNativeMenu(
        inside('<div data-selectable><p id="t">text</p></div>', "#t")
      )
    ).toBe(true);
    expect(
      keepsNativeMenu(inside('<div contenteditable="true"></div>', "div"))
    ).toBe(true);
  });

  it("suppresses it everywhere else", () => {
    expect(keepsNativeMenu(inside("<button>Go</button>", "button"))).toBe(
      false
    );
    expect(keepsNativeMenu(null)).toBe(false);
  });
});
