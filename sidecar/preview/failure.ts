export const RENDER_FAILURE_KINDS = [
  "asset",
  "crash",
  "encoder",
  "gl-lost",
  "gl-unavailable",
  "javascript",
  "stuck",
  "unknown",
] as const;

export type RenderFailureKind = (typeof RENDER_FAILURE_KINDS)[number];

export type GlSupport = "none" | "unknown" | "webgl1" | "webgl2";

export interface RenderContext {
  readonly gl: string | null;
  readonly glSource: string;
  readonly support: GlSupport;
}

export const UNKNOWN_CONTEXT: RenderContext = {
  gl: null,
  glSource: "default",
  support: "unknown",
};

export interface RenderDiagnosis {
  readonly hint: string | null;
  readonly kind: RenderFailureKind;
}

const GL_UNAVAILABLE = [
  /getContext\((['"`]?)webgl2?\1\)\s*returned null/i,
  /webgl2?\s+(?:is\s+)?(?:not\s+supported|not\s+available|unavailable)/i,
  /(?:could not|failed to|error)\s+(?:creat\w*|initializ\w*)\s+(?:a\s+|an\s+)?webgl/i,
  /THREE\.WebGLRenderer:\s*Error creating WebGL/i,
  /WebGL is not supported/i,
];

const GL_LOST = [
  /context\s+lost/i,
  /CONTEXT_LOST_WEBGL/,
  /webgl\s+context\s+was\s+lost/i,
];

const CRASHED = [
  /Aw,?\s*Snap/i,
  /Target closed/i,
  /Session closed/i,
  /Protocol error/i,
  /browser (?:has )?(?:crashed|disconnected)/i,
];

const STUCK = /delayRender\(\)/;

const ASSET = [
  /net::ERR_[A-Z_]+/,
  /\bERR_[A-Z_]{3,}/,
  /Failed to fetch/i,
  /\bENOENT\b/,
  /status code 404/i,
  /could not be loaded/i,
];

const ENCODER = [/\bffmpeg\b/i, /Invalid data found/i, /\bmuxer\b/i];

const JAVASCRIPT =
  /(?:^|\n|:\s)(?:TypeError|ReferenceError|SyntaxError|RangeError):/;

function anyOf(patterns: readonly RegExp[], message: string): boolean {
  return patterns.some((pattern) => pattern.test(message));
}

function backend(context: RenderContext): string {
  return context.gl === null ? "the browser's own default" : context.gl;
}

function glHint(context: RenderContext): string {
  const chosen = `The render browser is a headless Chrome of its own, not the preview's WebView, and it was opened with ${backend(context)} (${context.glSource}).`;

  return context.glSource === "config"
    ? `${chosen} That is the project's own Config.setChromiumOpenGlRenderer() setting, so the studio left it alone — try "angle" on a desktop, or "swangle" to draw in software.`
    : `${chosen} Set Config.setChromiumOpenGlRenderer() in remotion.config.ts to pick another backend — "angle" on a desktop with a GPU, "swangle" to draw in software.`;
}

function stuckHint(context: RenderContext): string {
  if (context.support === "none") {
    return `Nothing resolved a delayRender() in time, and this browser could not make a WebGL context at all — a scene that draws with WebGL never finishes compiling. ${glHint(context)}`;
  }

  const measured =
    context.support === "unknown"
      ? ""
      : ` WebGL is available in it (${context.support}), so this is unlikely to be the GPU.`;

  return `Nothing resolved a delayRender() in time. That is usually a font, a network request, a video that never becomes playable, or a shader that never compiles — the raw failure above says which asset, when it knows.${measured} Config.setDelayRenderTimeoutInMilliseconds() raises the wait if the scene is merely slow.`;
}

export function diagnoseRender(
  message: string,
  context: RenderContext = UNKNOWN_CONTEXT
): RenderDiagnosis {
  if (anyOf(GL_UNAVAILABLE, message)) {
    return { hint: glHint(context), kind: "gl-unavailable" };
  }

  if (anyOf(GL_LOST, message)) {
    return {
      hint: `The GPU dropped the scene's WebGL context mid-render, which is usually memory rather than capability. ${glHint(context)}`,
      kind: "gl-lost",
    };
  }

  if (anyOf(CRASHED, message)) {
    return {
      hint: "The render browser died mid-render. A 4K composition, a long scene or a heavy shader can exhaust the machine's memory; a smaller resolution is the quickest way to tell.",
      kind: "crash",
    };
  }

  if (STUCK.test(message)) {
    return { hint: stuckHint(context), kind: "stuck" };
  }

  if (anyOf(ASSET, message)) {
    return {
      hint: "A file the scene asked for did not arrive. The name is in the message above; check that it is in the project's public/ folder, or that the machine is online if it is a remote URL.",
      kind: "asset",
    };
  }

  if (anyOf(ENCODER, message)) {
    return {
      hint: "The frames rendered and the encoder refused them. A different format, or the project's own quality settings, is the next thing to try.",
      kind: "encoder",
    };
  }

  if (JAVASCRIPT.test(message)) {
    return {
      hint: "The scene's own code threw while rendering. The same frame in the preview should throw the same way.",
      kind: "javascript",
    };
  }

  return { hint: null, kind: "unknown" };
}

export function explainRender(
  message: string,
  context: RenderContext = UNKNOWN_CONTEXT
): string {
  const { hint } = diagnoseRender(message, context);

  return hint === null ? message : `${message}\n\n${hint}`;
}
