import { styleRoot } from "./surface";

const rules = new Map<string, HTMLStyleElement>();

export function hide(token: string, selectors: readonly string[]): void {
  reveal(token);
  if (selectors.length === 0) {
    return;
  }
  const style = document.createElement("style");
  style.setAttribute("data-studio-hidden", token);
  style.textContent = selectors
    .map((selector) => `${selector}{display:none!important}`)
    .join("\n");
  styleRoot().append(style);
  rules.set(token, style);
}

export function reveal(token: string): void {
  rules.get(token)?.remove();
  rules.delete(token);
}

export function revealAll(): void {
  for (const token of [...rules.keys()]) {
    reveal(token);
  }
}
