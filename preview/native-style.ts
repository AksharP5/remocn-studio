let target: ShadowRoot | null = null;
let disposed = false;
const pending: HTMLElement[] = [];
const fonts = new Map<CSSFontFaceRule, FontFace>();

function scopeRules(rules: CSSRuleList): void {
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      rule.selectorText = rule.selectorText
        .replace(/:root\b/g, ":host")
        .replace(/(^|[\s>+~,(])(?:html|body)(?=$|[\s.#:[>+~,)])/g, "$1:host")
        .replace(/:host\s+(?:>\s*)?:host/g, ":host");
    } else if (rule instanceof CSSFontFaceRule && !fonts.has(rule)) {
      const style = rule.style;
      const family = style.getPropertyValue("font-family").replace(/^["']|["']$/g, "");
      const source = style.getPropertyValue("src");
      if (!family || !source) continue;
      const font = new FontFace(family, source, {
        style: style.getPropertyValue("font-style") || "normal",
        weight: style.getPropertyValue("font-weight") || "normal",
        stretch: style.getPropertyValue("font-stretch") || "normal",
        unicodeRange: style.getPropertyValue("unicode-range") || "U+0-10FFFF",
        display: (style.getPropertyValue("font-display") || "auto") as FontDisplay,
      });
      fonts.set(rule, font);
      document.fonts.add(font);
    } else if ("cssRules" in rule) {
      scopeRules((rule as CSSGroupingRule).cssRules);
    }
  }
}

function refresh(): void {
  if (!target || disposed) return;
  for (const element of target.querySelectorAll("style")) {
    if (element.sheet) scopeRules(element.sheet.cssRules);
  }
}

export default function insertNativeStyle(element: HTMLElement): void {
  if (disposed) return;
  if (target) target.appendChild(element);
  else pending.push(element);
}

export function mountStyles(root: ShadowRoot): () => void {
  target = root;
  for (const element of pending.splice(0)) root.appendChild(element);
  refresh();
  const observer = new MutationObserver((records) => {
    if (records.some((record) =>
      record.target instanceof HTMLStyleElement || record.target.parentElement instanceof HTMLStyleElement ||
      [...record.addedNodes].some((node) => node instanceof Element && (node.matches("style") || node.querySelector("style")))
    )) refresh();
  });
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  return () => {
    disposed = true;
    observer.disconnect();
    for (const font of fonts.values()) document.fonts.delete(font);
    fonts.clear();
    target = null;
    pending.length = 0;
  };
}
