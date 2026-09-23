import saved from "./paper-ui.config.json";

export const CONFIG_PATH = "app/lab/paper-ui/paper-ui.config.json";

export const ACCENTS = {
  blue: { dark: "#a0b8ef", label: "Blue", light: "#3b5799" },
  ivory: { dark: "#e5e5da", label: "Ivory", light: "#33332f" },
  neutral: { dark: "#ffffff", label: "Neutral", light: "#33332f" },
  violet: { dark: "#bda7e8", label: "Violet", light: "#705099" },
} as const;

export const FONTS = {
  "dm-sans": "DM Sans",
  inter: "Inter",
  system: "System sans",
} as const;

export interface Parameters {
  accent: keyof typeof ACCENTS;
  borderOpacity: number;
  canvas: number;
  font: keyof typeof FONTS;
  radius: number;
  surfaceStep: number;
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
  {
    key: "canvas",
    label: "Dark background tone",
    max: 56,
    min: 12,
    step: 1,
    unit: "",
  },
  {
    key: "surfaceStep",
    label: "Surface contrast",
    max: 18,
    min: 4,
    step: 1,
    unit: "",
  },
  {
    key: "borderOpacity",
    label: "Dark border contrast",
    max: 18,
    min: 5,
    step: 1,
    unit: "%",
  },
  {
    key: "radius",
    label: "Corner radius",
    max: 12,
    min: 2,
    step: 1,
    unit: "px",
  },
];

export const CODEX: Parameters = {
  accent: "neutral",
  borderOpacity: 8,
  canvas: 24,
  font: "dm-sans",
  radius: 5,
  surfaceStep: 10,
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
    if (
      typeof number !== "number" ||
      !Number.isFinite(number) ||
      number < control.min ||
      number > control.max
    ) {
      throw new Error(
        `${control.label} must be between ${control.min} and ${control.max}.`
      );
    }
    result[control.key] = number;
  }
  if (
    parameters.accent !== "neutral" &&
    parameters.accent !== "blue" &&
    parameters.accent !== "ivory" &&
    parameters.accent !== "violet"
  ) {
    throw new Error("Choose a supported accent color.");
  }
  result.accent = parameters.accent;
  if (document.version === 2) {
    if (
      parameters.font !== "dm-sans" &&
      parameters.font !== "inter" &&
      parameters.font !== "system"
    ) {
      throw new Error("Choose a supported font.");
    }
    result.font = parameters.font;
  }
  return result;
}

export const INITIAL = parseParameters(saved);

function defaultFontFamily(font: Parameters["font"]): string {
  if (font === "system") {
    return 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  }
  return `"${font === "dm-sans" ? "DM Sans" : "Inter"}", var(--font-cyrillic), sans-serif`;
}

export function tokensOf(parameters: Parameters, mode: "light" | "dark") {
  const dark = mode === "dark";
  const gray = (value: number) => `rgb(${value} ${value} ${value})`;
  const overlay = (opacity: number) =>
    `rgb(${dark ? "255 255 255" : "0 0 0"} / ${opacity})`;
  const lightCanvas = 248;
  const background = gray(dark ? parameters.canvas : lightCanvas);
  const surface = gray(dark ? parameters.canvas + parameters.surfaceStep : 255);
  const foreground = dark ? "#f3f3f3" : "#282824";
  const muted = dark ? "#afafaf" : "#6a6a64";
  const accent = ACCENTS[parameters.accent][mode];
  const accentForeground = dark ? "#181818" : "#fafaf6";
  const border = overlay(dark ? parameters.borderOpacity / 100 : 0.09);
  const tokens: Record<`--${string}`, string> = {
    "--accent": dark ? gray(parameters.canvas + 26) : overlay(0.055),
    "--accent-foreground": foreground,
    "--background": background,
    "--border": border,
    "--card": surface,
    "--card-foreground": foreground,
    "--code": surface,
    "--code-foreground": foreground,
    "--code-highlight": dark ? gray(parameters.canvas + 26) : overlay(0.055),
    "--code-number": muted,
    "--field": dark ? gray(parameters.canvas + 27) : background,
    "--foreground": foreground,
    "--input": dark ? overlay((parameters.borderOpacity + 2) / 100) : border,
    "--muted": dark ? surface : overlay(0.045),
    "--muted-foreground": muted,
    "--pane-border": border,
    "--popover": dark
      ? gray(parameters.canvas + parameters.surfaceStep * 2)
      : surface,
    "--popover-foreground": foreground,
    "--primary": accent,
    "--primary-foreground": accentForeground,
    "--radius": `${parameters.radius / 16}rem`,
    "--reference": ACCENTS.blue[mode],
    "--ring": dark ? "#a3a3a3" : "#777770",
    "--secondary": dark
      ? gray(parameters.canvas + parameters.surfaceStep * 2)
      : overlay(0.045),
    "--secondary-foreground": foreground,
    "--sidebar": gray(dark ? parameters.canvas : 240),
    "--sidebar-accent": dark
      ? gray(parameters.canvas + parameters.surfaceStep * 2)
      : overlay(0.055),
    "--sidebar-accent-foreground": foreground,
    "--sidebar-border": border,
    "--sidebar-foreground": dark ? "#d4d4d4" : "#5d5d57",
    "--sidebar-primary": accent,
    "--sidebar-primary-foreground": accentForeground,
    "--sidebar-ring": dark ? "#a3a3a3" : "#777770",
  };
  const family = defaultFontFamily(parameters.font);
  tokens["--font-sans"] = family;
  tokens["--font-heading"] = family;
  return tokens;
}

export function themeCss(
  parameters: Parameters,
  dmSansFamily: string,
  interFamily: string
) {
  const declarations = (mode: "light" | "dark") => {
    const tokens = tokensOf(parameters, mode);
    if (parameters.font !== "system") {
      const family = `${parameters.font === "dm-sans" ? dmSansFamily : interFamily}, var(--font-cyrillic), sans-serif`;
      tokens["--font-sans"] = family;
      tokens["--font-heading"] = family;
    }
    return Object.entries(tokens)
      .map(([key, value]) => `${key}: ${value};`)
      .join("\n");
  };
  // Root scope includes body portals; the route marker keeps the theme local to this page.
  const scope = ':root:has([data-paper-ui-preview="paper"])';
  return `${scope} { ${declarations("light")} }\n${scope}.dark { ${declarations("dark")} }`;
}

export function serialize(parameters: Parameters): string {
  return `${JSON.stringify(
    {
      parameters,
      reference: "Codex desktop screenshot supplied by the user",
      tokens: {
        dark: tokensOf(parameters, "dark"),
        light: tokensOf(parameters, "light"),
      },
      version: 2,
    },
    null,
    2
  )}\n`;
}
