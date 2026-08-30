export type Platform = "linux" | "mac" | "windows";

const MAC_AGENT = /mac|iphone|ipad|ipod|darwin/i;

const WINDOWS_AGENT = /windows/i;

export function platformOf(userAgent: string): Platform {
  if (MAC_AGENT.test(userAgent)) {
    return "mac";
  }

  if (WINDOWS_AGENT.test(userAgent)) {
    return "windows";
  }

  return "linux";
}

export function currentPlatform(): Platform {
  return typeof navigator === "undefined"
    ? "mac"
    : platformOf(navigator.userAgent);
}

export function modKeyLabel(platform: Platform = currentPlatform()): string {
  return platform === "mac" ? "⌘" : "Ctrl";
}

export function modKeyCombo(
  key: string,
  platform: Platform = currentPlatform()
): string {
  return platform === "mac" ? `⌘${key}` : `Ctrl+${key}`;
}

export function fileManagerName(
  platform: Platform = currentPlatform()
): string {
  if (platform === "mac") {
    return "Finder";
  }

  return platform === "windows" ? "File Explorer" : "Files";
}
