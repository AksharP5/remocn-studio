/**
 * The two shapes a picture in the project's `public/` takes.
 *
 * The pane holds the name `staticFile()` would be given — `bg.png`,
 * `library/logo.png` — because that is what the code says and what the agent
 * is asked for. dialkit's image control holds a URL, because the value it is
 * given is the `src` it draws. This is where the two meet: the base is the
 * preview host's own static prefix, absolute, so the picture loads in the app
 * window and not only inside the preview's iframe.
 */
export interface StaticFile {
  readonly label: string;
  readonly value: string;
}

const SCHEME = /^[a-z][a-z\d+\-.]*:/i;

/** What an `<img>` in the app window can load for a name. */
export function assetUrl(name: string, base: string | null): string {
  if (name.length === 0 || isAbsolute(name) || base === null) {
    return name;
  }

  return `${base}${encodeSegments(name)}`;
}

/** The name behind a URL the control handed back. */
export function assetName(url: string, base: string | null): string {
  if (base === null || !url.startsWith(base)) {
    return url;
  }

  return decodeSegments(url.slice(base.length));
}

export function assetOptions(
  names: readonly string[],
  base: string | null
): StaticFile[] {
  return names.map((name) => ({ label: name, value: assetUrl(name, base) }));
}

function isAbsolute(name: string): boolean {
  return SCHEME.test(name) || name.startsWith("/");
}

function encodeSegments(name: string): string {
  return name.split("/").map(encodeURIComponent).join("/");
}

function decodeSegments(name: string): string {
  try {
    return name.split("/").map(decodeURIComponent).join("/");
  } catch {
    return name;
  }
}
