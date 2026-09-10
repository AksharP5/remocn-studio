// biome-ignore-all lint/performance/useTopLevelRegex: this function is serialized into Chromium, so helpers cannot reference module scope.
export interface ReadinessText {
  bbox: { x: number; y: number; width: number; height: number };
  opacity: number;
  readable: boolean;
  role: string;
  selector: string;
  text: string;
  visibleText: string;
}
export interface ReadinessFrame {
  contrast: {
    selector: string;
    ratio: number | null;
    threshold: number;
    reason: string;
  }[];
  darkFraction: number;
  limitations: string[];
  motionPlans?: { json: string; localFrame: number }[];
  motionTargets?: {
    id: string;
    opacity: number;
    bbox: { x: number; y: number; width: number; height: number };
  }[];
  pixelHash: string;
  resources: { resource: string; reason: string; selector: string }[];
  texts: ReadinessText[];
}

// Serialized into the render page: keep every runtime helper inside this function.
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: all DOM helpers must travel inside this serialized function.
export async function probeReadiness(
  png: string,
  opacityThreshold: number
): Promise<ReadinessFrame> {
  const selector = (element: Element): string => {
    const id = element.getAttribute("data-design-id");
    if (id) {
      return `[data-design-id="${CSS.escape(id)}"]`;
    }
    if (element.id) {
      return `#${CSS.escape(element.id)}`;
    }
    const parts: string[] = [];
    let current: Element | null = element;
    while (current && current !== document.body) {
      const parent: Element | null = current.parentElement;
      parts.unshift(
        `${current.tagName.toLowerCase()}:nth-child(${parent ? [...parent.children].indexOf(current) + 1 : 1})`
      );
      current = parent;
    }
    return `body > ${parts.join(" > ")}`;
  };
  const opacity = (element: Element): number => {
    let value = 1;
    for (let node: Element | null = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.visibility !== "visible" || style.display === "none") {
        return 0;
      }
      value *= Number(style.opacity);
    }
    return value;
  };
  const box = (rect: DOMRect) => ({
    height: rect.height,
    width: rect.width,
    x: rect.x,
    y: rect.y,
  });
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: visibility combines independent opacity, clipping and hit-test conditions.
  const readable = (element: Element, rect: DOMRect): boolean => {
    if (
      opacity(element) < opacityThreshold ||
      rect.width === 0 ||
      rect.height === 0 ||
      rect.left < -1 ||
      rect.top < -1 ||
      rect.right > innerWidth + 1 ||
      rect.bottom > innerHeight + 1
    ) {
      return false;
    }
    for (let node: Element | null = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      const bounds = node.getBoundingClientRect();
      if (
        (/(hidden|clip|scroll|auto)/.test(style.overflowX) &&
          (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)) ||
        (/(hidden|clip|scroll|auto)/.test(style.overflowY) &&
          (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1))
      ) {
        return false;
      }
    }
    let covered = 0;
    for (const fraction of [0.2, 0.5, 0.8]) {
      const stack = document.elementsFromPoint(
        rect.left + rect.width * fraction,
        rect.top + rect.height / 2
      );
      for (const above of stack) {
        if (above === element || element.contains(above)) {
          break;
        }
        if (above.contains(element) || opacity(above) < 0.1) {
          continue;
        }
        const style = getComputedStyle(above);
        if (
          style.backgroundColor !== "rgba(0, 0, 0, 0)" ||
          /^(IMG|VIDEO|CANVAS|SVG)$/.test(above.tagName)
        ) {
          covered += 1;
          break;
        }
      }
    }
    return covered < 2;
  };
  const groups = new Map<Element, ReadinessText>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const element = node.parentElement;
    if (
      !element ||
      /^(SCRIPT|STYLE|NOSCRIPT)$/.test(element.tagName) ||
      !node.textContent?.trim()
    ) {
      continue;
    }
    let group = element.closest("[data-reading-id]") ?? element;
    if (!element.closest("[data-reading-id]")) {
      while (
        group.parentElement &&
        group.parentElement !== document.body &&
        getComputedStyle(group).display === "inline"
      ) {
        group = group.parentElement;
      }
    }
    const range = document.createRange();
    const text = node.textContent;
    const rects = [...text.matchAll(/\S+/gu)].flatMap((match) => {
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      return [...range.getClientRects()];
    });
    const shown =
      rects.length > 0 && rects.every((rect) => readable(element, rect));
    const existing = groups.get(group) ?? {
      bbox: box(group.getBoundingClientRect()),
      opacity: opacity(group),
      readable: true,
      role: group.getAttribute("data-design-role") ?? "text",
      selector: selector(group),
      text: "",
      visibleText: "",
    };
    existing.text += text;
    if (shown) {
      existing.visibleText += text;
    }
    existing.readable &&= shown;
    groups.set(group, existing);
  }
  for (const element of document.querySelectorAll(
    '[data-design-role="logo"], [data-design-role="cta"], [data-design-role="subtitle"]'
  )) {
    if (!groups.has(element) && opacity(element) > 0.1) {
      groups.set(element, {
        bbox: box(element.getBoundingClientRect()),
        opacity: opacity(element),
        readable: true,
        role: element.getAttribute("data-design-role") ?? "",
        selector: selector(element),
        text: element.getAttribute("aria-label") ?? "",
        visibleText: "",
      });
    }
  }
  const resources: ReadinessFrame["resources"] = [];
  for (const image of document.images) {
    if (image.complete && image.naturalWidth === 0) {
      resources.push({
        reason: "Image could not be loaded or decoded.",
        resource: image.currentSrc || image.src,
        selector: selector(image),
      });
    }
  }
  for (const media of document.querySelectorAll<HTMLMediaElement>(
    "video,audio"
  )) {
    if (media.error) {
      resources.push({
        reason: `Media error ${media.error.code}: ${media.error.message}`,
        resource: media.currentSrc || media.src,
        selector: selector(media),
      });
    }
  }
  for (const font of document.fonts) {
    if (font.status === "error") {
      resources.push({
        reason: "FontFace failed to load.",
        resource: font.family,
        selector: "document.fonts",
      });
    }
  }
  const limitations: string[] = [];
  if (document.fonts.status !== "loaded") {
    limitations.push("Fonts are still loading at this sample.");
  }
  if (document.querySelector("canvas")) {
    limitations.push(
      "Canvas/WebGL text cannot be inspected as DOM text; pixel motion is measured."
    );
  }
  if (document.querySelector("video")) {
    limitations.push(
      "Text burned into video requires OCR; DOM text checks do not cover it."
    );
  }
  for (const element of document.querySelectorAll("[data-expected-font]")) {
    const expected = element.getAttribute("data-expected-font") ?? "";
    const declared = getComputedStyle(element)
      .fontFamily.split(",")[0]
      ?.replace(/["']/g, "")
      .trim();
    if (declared === expected) {
      limitations.push(
        `Font glyph fallback for ${expected} is not observable through computed CSS alone.`
      );
    } else {
      resources.push({
        reason: `Expected font ${expected}; computed primary family is ${declared}.`,
        resource: expected,
        selector: selector(element),
      });
    }
  }
  const image = new Image();
  image.src = `data:image/png;base64,${png}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Cannot inspect rendered pixels.");
  }
  context.drawImage(image, 0, 0, 32, 32);
  const pixels = context.getImageData(0, 0, 32, 32).data;
  let dark = 0;
  let hash = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (
      Math.max(pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0) < 8 ||
      (pixels[i + 3] ?? 0) < 8
    ) {
      dark += 1;
    }
    for (let c = 0; c < 4; c += 1) {
      hash = (hash * 31 + (pixels[i + c] ?? 0)) % 4_294_967_296;
    }
  }
  const contrast =
    (window as Window & { __remocnContrast?: ReadinessFrame["contrast"] })
      .__remocnContrast ?? [];
  for (const measurement of contrast) {
    let target: Element | null = null;
    try {
      target = document.querySelector(measurement.selector);
    } catch {
      /* unsupported selector is reported below */
    }
    for (let current = target; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (
        style.mixBlendMode !== "normal" ||
        style.filter !== "none" ||
        style.backgroundClip === "text" ||
        style.webkitBackgroundClip === "text"
      ) {
        measurement.ratio = null;
        measurement.reason =
          "Filtered, blended or gradient text paint cannot be measured as a solid foreground.";
      }
    }
  }
  for (const [element, text] of groups) {
    if (!text.visibleText.trim()) {
      continue;
    }
    const measured = contrast.some((row) => {
      try {
        const target = document.querySelector(row.selector);
        return target === element || (!!target && element.contains(target));
      } catch {
        return false;
      }
    });
    if (!measured) {
      contrast.push({
        ratio: null,
        reason:
          "No supported solid text/background measurement for this text group.",
        selector: text.selector,
        threshold: 0,
      });
    }
  }
  return {
    contrast,
    darkFraction: dark / 1024,
    limitations,
    motionPlans: [...document.querySelectorAll("[data-studio-motion-plan]")]
      // Include one excess marker so the collector reports its bounded limit.
      .slice(0, 129)
      .map((element) => ({
        json: (element.getAttribute("data-studio-motion-plan") ?? "").slice(
          0,
          262_145
        ),
        localFrame: Number(element.getAttribute("data-studio-motion-frame")),
      })),
    motionTargets: [...document.querySelectorAll("[data-motion-cue]")]
      .slice(0, 4096)
      .map((element) => ({
        bbox: box(element.getBoundingClientRect()),
        id: element.getAttribute("data-motion-cue") ?? "",
        opacity: opacity(element),
      })),
    pixelHash: String(hash),
    resources,
    texts: [...groups.values()],
  };
}
