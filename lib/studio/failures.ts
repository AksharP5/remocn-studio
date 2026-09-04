import { CANCELLED, type SidecarPhase } from "@/shared/ipc";
import { baseName } from "./paths";

// Remotion's stock advice for a fetch it could not make. It is written for a CI
// container and is wrong in a desktop app — measured: the real cause was a proxy
// port of 0, and the agent, reading this sentence in the transcript, spent a
// tool call on `df -h` before working that out. A wrong diagnosis costs a wrong
// first hypothesis every time it is shown.
const DISK_ADVICE =
  /This could be caused by Chrome rejecting the request because the disk space is low\.?\s*(Consider increasing the disk size of your environment\.?)?/gi;

// The percent-encoded `staticFile` URL a failed offthread fetch carries: about
// 300 characters of noise around one useful fact, which is the file's name.
const PROXY_FETCH = /Failed to fetch\s+(\S*\/proxy\?\S+)/i;

const SRC = /[?&]src=([^&\s]+)/;

// A long URL is one unbreakable word, so it left the pane entirely — clipped
// mid-token with no wrap and no scroll. Wording it is the fix; the wrapping in
// the pane is the insurance for whatever a renderer says next.
export function renderFailure(message: string): string {
  const said = message.replace(DISK_ADVICE, "").trim();
  const asset = proxiedAsset(said);

  if (asset !== null) {
    return `The frame could not be rendered: the video ${asset} would not load.`;
  }

  return said.length === 0 ? message.trim() : said;
}

function proxiedAsset(message: string): string | null {
  const fetched = PROXY_FETCH.exec(message);
  if (fetched === null) {
    return null;
  }

  const src = SRC.exec(fetched[1] ?? "");
  if (src?.[1] === undefined) {
    return null;
  }

  return named(src[1]);
}

function named(encoded: string): string | null {
  try {
    const path = decodeURIComponent(decodeURIComponent(encoded));
    const name = baseName(path.split("?")[0] ?? path);
    return name.length === 0 ? null : name;
  } catch {
    return null;
  }
}

// `cancelled` is the sidecar's own reply frame — what `Effect.onExit` answers so
// a killed handler still answers at all. A good protocol decision and a terrible
// thing to print: nobody cancelled anything, the process died. The preview is
// re-armed automatically, so this is what the pane says in the gap.
export function previewFailure(message: string): string {
  return message.trim() === CANCELLED
    ? "The preview stopped when the sidecar restarted."
    : message;
}

// The preview is the one thing that did not come back on its own after a crash:
// its request is long-lived, so the death correctly fails it, and nothing then
// re-established it. Every other pane healed itself and the one costing seven
// seconds to rebuild was the one left needing a click on an unlabelled button.
// Only `restarting` and `down` count as losing it — `starting` is also what a
// cold boot looks like, and re-arming there would launch the preview twice.
export function previewRecovery(
  lost: boolean,
  phase: SidecarPhase | "unknown"
): { lost: boolean; relaunch: boolean } {
  if (phase === "restarting" || phase === "down") {
    return { lost: true, relaunch: false };
  }

  return phase === "ready" && lost
    ? { lost: false, relaunch: true }
    : { lost, relaunch: false };
}
