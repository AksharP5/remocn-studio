const VIDEO_CONTAINER = "video-container";
const SITE_VERSION = "11";

export interface PageOptions {
  publicPath: string;
  staticBase: string;
  title: string;
  version: string;
}

export function renderPage(options: PageOptions): string {
  return page({
    body: `<div id="${VIDEO_CONTAINER}"></div>`,
    globals: {
      ...shared(options),
      process: { env: { NODE_ENV: "production" } },
      remotion_envVariables: "",
      remotion_version: options.version,
      siteVersion: SITE_VERSION,
    },
    head: "",
    scripts: [],
    source: "bundle.js",
    title: options.title,
  });
}

function shared(options: PageOptions): Record<string, unknown> {
  return {
    remotion_audioEnabled: true,
    remotion_audioLatencyHint: "playback",
    remotion_envVariables: "{}",
    remotion_isStudio: false,
    remotion_logLevel: "info",
    remotion_numberOfAudioTags: 0,
    remotion_previewSampleRate: 48_000,
    remotion_publicPath: options.publicPath,
    remotion_sampleRate: 48_000,
    remotion_staticBase: options.staticBase,
    remotion_videoEnabled: true,
  };
}

function page(parts: {
  body: string;
  globals: Record<string, unknown>;
  head: string;
  scripts: readonly string[];
  source: string;
  title: string;
}): string {
  const assigned = Object.entries(parts.globals)
    .map(([key, value]) => `window.${key} = ${JSON.stringify(value)};`)
    .join("\n      ");

  const extra = parts.scripts
    .map((src) => `\n    <script src="${src}"></script>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(parts.title)}</title>
    ${parts.head}
  </head>
  <body>
    <script>
      ${assigned}
    </script>${extra}
    ${parts.body}
    <script src="${parts.source}"></script>
  </body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
