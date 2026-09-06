import { Exit, Schema } from "effect";
import {
  isProjectTemplate,
  type ProjectTemplate,
  type TemplateProps as Props,
  TemplateProps,
} from "./templates";

export const DEEP_LINK_SCHEME = "remocn-studio";

export const OPEN_TEMPLATE_ROUTE = "open-template";

export interface OpenTemplateLink {
  readonly props: Props;
  readonly template: ProjectTemplate;
  readonly type: "open-template";
}

export type DeepLinkRoute = OpenTemplateLink;

export type DeepLink =
  | { readonly ok: true; readonly route: DeepLinkRoute }
  | { readonly ok: false; readonly reason: string };

const decodeProps = Schema.decodeUnknownExit(TemplateProps);

const NOT_OURS = "This link is not a Remocn Studio link.";
const NO_ROUTE = (route: string) =>
  `This link asks the studio to “${route}”, which it cannot do.`;
const NO_TEMPLATE = "This link names no template.";
const UNKNOWN_TEMPLATE = (template: string) =>
  `This link names a template the studio does not have: ${template}.`;
const NO_PROPS = "This link carries no props for the template.";
const BAD_PROPS = "The props in this link could not be read.";
const WRONG_PROPS =
  "The props in this link are not the ones the template expects.";

export function parseDeepLink(raw: string): DeepLink {
  const url = parseUrl(raw);
  if (url === null || url.protocol !== `${DEEP_LINK_SCHEME}:`) {
    return refused(NOT_OURS);
  }

  const route = routeOf(url);
  if (route !== OPEN_TEMPLATE_ROUTE) {
    return refused(NO_ROUTE(route));
  }

  const template = url.searchParams.get("template");
  if (template === null || template.length === 0) {
    return refused(NO_TEMPLATE);
  }
  if (!isProjectTemplate(template)) {
    return refused(UNKNOWN_TEMPLATE(template));
  }

  const encoded = url.searchParams.get("props");
  if (encoded === null || encoded.length === 0) {
    return refused(NO_PROPS);
  }

  const json = decodeBase64Url(encoded);
  if (json === null) {
    return refused(BAD_PROPS);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return refused(BAD_PROPS);
  }

  const props = decodeProps(parsed);
  if (Exit.isFailure(props)) {
    return refused(WRONG_PROPS);
  }

  return {
    ok: true,
    route: { props: props.value, template, type: "open-template" },
  };
}

// `remocn-studio://open-template?…` puts the route in the host, and a link
// written with a slash after it — `remocn-studio:///open-template` — in the
// path; either spelling names the same handler.
function routeOf(url: URL): string {
  const host = url.host.trim();
  if (host.length > 0) {
    return host;
  }
  return url.pathname.replace(/^\/+|\/+$/g, "");
}

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export function decodeBase64Url(encoded: string): string | null {
  const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function refused(reason: string): DeepLink {
  return { ok: false, reason };
}
