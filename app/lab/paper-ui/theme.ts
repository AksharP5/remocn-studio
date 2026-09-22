import saved from "./paper-ui.config.json";

export const CONFIG_PATH = "app/lab/paper-ui/paper-ui.config.json";

export const ACCENTS = {
  neutral: { label: "Neutral", dark: "#ffffff", light: "#33332f" },
  ivory: { label: "Ivory", dark: "#e5e5da", light: "#33332f" },
  blue: { label: "Blue", dark: "#a0b8ef", light: "#3b5799" },
  violet: { label: "Violet", dark: "#bda7e8", light: "#705099" },
} as const;

export const FONTS = {
  "dm-sans": "DM Sans",
  inter: "Inter",
  system: "System sans",
} as const;

export interface Parameters {
  canvas: number;
  surfaceStep: number;
  borderOpacity: number;
  radius: number;
  accent: keyof typeof ACCENTS;
  font: keyof typeof FONTS;
}

type NumericParameter = Exclude<keyof Parameters, "accent" | "font">;

export const CONTROLS: {
  key: NumericParameter;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}[] = [
  { key: "canvas", label: "Dark background tone", min: 12, max: 56, step: 1, unit: "" },
  { key: "surfaceStep", label: "Surface contrast", min: 4, max: 18, step: 1, unit: "" },
  { key: "borderOpacity", label: "Dark border contrast", min: 5, max: 18, step: 1, unit: "%" },
  { key: "radius", label: "Corner radius", min: 2, max: 12, step: 1, unit: "px" },
];

export const CODEX: Parameters = {
  canvas: 24,
  surfaceStep: 10,
  borderOpacity: 8,
  radius: 5,
  accent: "neutral",
  font: "dm-sans",
};

export function parseParameters(value: unknown): Parameters {
  if (typeof value !== "object" || value === null) {
    throw new Error("Choose a Paper UI configuration file.");
  }
  const document = value as Record<string, unknown>;
  if (
    (document.version !== 1 && document.version !== 2) ||
    typeof document.parameters !== "object" ||
    document.parameters === null
  ) {
    throw new Error("This file is not a supported Paper UI configuration.");
  }
  const parameters = document.parameters as Record<string, unknown>;
  const result = { ...CODEX };
  for (const control of CONTROLS) {
    const number = parameters[control.key];
    if (typeof number !== "number" || !Number.isFinite(number) || number < control.min || number > control.max) {
      throw new Error(`${control.label} must be between ${control.min} and ${control.max}.`);
    }
    result[control.key] = number;
  }
  if (parameters.accent !== "neutral" && parameters.accent !== "blue" && parameters.accent !== "ivory" && parameters.accent !== "violet") {
    throw new Error("Choose a supported accent color.");
  }
  result.accent = parameters.accent;
  if (document.version === 2) {
    if (parameters.font !== "dm-sans" && parameters.font !== "inter" && parameters.font !== "system") {
      throw new Error("Choose a supported font.");
    }
    result.font = parameters.font;
  }
  return result;
}

export const INITIAL = parseParameters(saved);

export function tokensOf(parameters: Parameters, mode: "light" | "dark") {
  const dark = mode === "dark";
  const gray = (value: number) => `rgb(${value} ${value} ${value})`;
  const overlay = (opacity: number) => `rgb(${dark ? "255 255 255" : "0 0 0"} / ${opacity})`;
  const lightCanvas = 248;
  const background = gray(dark ? parameters.canvas : lightCanvas);
  const surface = gray(dark ? parameters.canvas + parameters.surfaceStep : 255);
  const foreground = dark ? "#f3f3f3" : "#282824";
  const muted = dark ? "#afafaf" : "#6a6a64";
  const accent = ACCENTS[parameters.accent][mode];
  const accentForeground = dark ? "#181818" : "#fafaf6";
  const border = overlay(dark ? parameters.borderOpacity / 100 : 0.09);
  const tokens: Record<`--${string}`, string> = {
    "--radius": `${parameters.radius / 16}rem`,
    "--background": background,
    "--foreground": foreground,
    "--card": surface,
    "--card-foreground": foreground,
    "--popover": dark ? gray(parameters.canvas + parameters.surfaceStep * 2) : surface,
    "--popover-foreground": foreground,
    "--primary": accent,
    "--primary-foreground": accentForeground,
    "--secondary": dark ? gray(parameters.canvas + parameters.surfaceStep * 2) : overlay(0.045),
    "--secondary-foreground": foreground,
    "--muted": dark ? surface : overlay(0.045),
    "--muted-foreground": muted,
    "--accent": dark ? gray(parameters.canvas + 26) : overlay(0.055),
    "--accent-foreground": foreground,
    "--border": border,
    "--input": dark ? overlay((parameters.borderOpacity + 2) / 100) : border,
    "--field": dark ? gray(parameters.canvas + 27) : background,
    "--ring": dark ? "#a3a3a3" : "#777770",
    "--sidebar": gray(dark ? parameters.canvas : 240),
    "--sidebar-foreground": dark ? "#d4d4d4" : "#5d5d57",
    "--sidebar-primary": accent,
    "--sidebar-primary-foreground": accentForeground,
    "--sidebar-accent": dark ? gray(parameters.canvas + parameters.surfaceStep * 2) : overlay(0.055),
    "--sidebar-accent-foreground": foreground,
    "--sidebar-border": border,
    "--sidebar-ring": dark ? "#a3a3a3" : "#777770",
    "--pane-border": border,
    "--code": surface,
    "--code-foreground": foreground,
    "--code-highlight": dark ? gray(parameters.canvas + 26) : overlay(0.055),
    "--code-number": muted,
    "--reference": ACCENTS.blue[mode],
  };
  const family = parameters.font === "system"
    ? 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    : `"${parameters.font === "dm-sans" ? "DM Sans" : "Inter"}", var(--font-cyrillic), sans-serif`;
  tokens["--font-sans"] = family;
  tokens["--font-heading"] = family;
  return tokens;
}

export function themeCss(parameters: Parameters, dmSansFamily: string, interFamily: string) {
  const declarations = (mode: "light" | "dark") => {
    const tokens = tokensOf(parameters, mode);
    if (parameters.font !== "system") {
      const family = `${parameters.font === "dm-sans" ? dmSansFamily : interFamily}, var(--font-cyrillic), sans-serif`;
      tokens["--font-sans"] = family;
      tokens["--font-heading"] = family;
    }
    return Object.entries(tokens).map(([key, value]) => `${key}: ${value};`).join("\n");
  };
  // Root scope includes body portals; the route marker keeps the theme local to this page.
  const scope = ':root:has([data-paper-ui-preview="paper"])';
  return `${scope} { ${declarations("light")} }\n${scope}.dark { ${declarations("dark")} }`;
}

export function serialize(parameters: Parameters): string {
  return `${JSON.stringify({
    version: 2,
    reference: "Codex desktop screenshot supplied by the user",
    parameters,
    tokens: { light: tokensOf(parameters, "light"), dark: tokensOf(parameters, "dark") },
  }, null, 2)}\n`;
}
