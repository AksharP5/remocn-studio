// The tips are data, not code scattered across the panes: one catalog, one
// availability rule per entry, and a pure choice of which single tip is worth
// showing right now. Nothing here renders, so the rules are pinned by a table
// rather than by mounting the app.

export const TOUR_IDS = [
  "composer",
  "preview-tools",
  "library",
  "plan",
  "sessions",
] as const;

export type TourId = (typeof TOUR_IDS)[number];

export function isTourId(value: string): value is TourId {
  return (TOUR_IDS as readonly string[]).includes(value);
}

// What a "Show me" does. The reveal is always something the person could do
// themselves in one click and can undo the same way — a pane that opens, a
// drawer that expands. Arming Inspect is deliberately not one of these: a tip
// must not put the app into a mode nobody asked for.
export type TourReveal = "assets" | "plan";

export interface TourAction {
  readonly label: string;
  readonly reveal: TourReveal;
}

export interface TourTip {
  readonly action: TourAction | null;
  readonly align: "center" | "end" | "start";
  readonly body: string;
  readonly id: TourId;
  readonly side: "bottom" | "left" | "right" | "top";
  readonly title: string;
}

// The element a tip points at carries `data-tour="<id>"`, so the anchor and
// the tip are named by one string and cannot drift apart.
export function tourAnchor(id: TourId): string {
  return `[data-tour="${id}"]`;
}

// Order is priority: when two features become available at once, the earlier
// entry is the one that gets the screen.
export const TOUR_TIPS: readonly TourTip[] = [
  {
    action: null,
    align: "center",
    body: "Describe the scene and the agent writes the Remotion code for it. ⌘V pastes a picture straight into the message, “+” attaches a video or a sound, and the chips underneath set the mode, the model and how hard it thinks.",
    id: "composer",
    side: "top",
    title: "This is where a video starts",
  },
  {
    action: null,
    align: "end",
    body: "Inspect picks an element out of the frame, so you can say what should change about that exact thing. Snapshot sends the frame — or a part of it you drag — into the message. Export renders the mp4.",
    id: "preview-tools",
    side: "bottom",
    title: "Point at the picture instead of describing it",
  },
  {
    action: { label: "Show me", reveal: "assets" },
    align: "start",
    body: "Assets holds pictures, clips and finished components outside any one project. Drop a file on this pane, or ask the agent to save an animation, and it is one click away in the next video.",
    id: "library",
    side: "right",
    title: "Save it once, use it in every video",
  },
  {
    action: { label: "Show me", reveal: "plan" },
    align: "center",
    body: "When the agent plans before it builds, this strip shows the step it is on. Open it for the whole checklist — it stays there after the turn ends.",
    id: "plan",
    side: "top",
    title: "The plan lives here",
  },
  {
    action: null,
    align: "start",
    body: "A turn keeps running while you look somewhere else. A chat that finished without you carries a dot, and one waiting on your approval says so on its row.",
    id: "sessions",
    side: "right",
    title: "Turns keep running when you look away",
  },
];

// Everything a tip needs to know about the app, and nothing else: each field
// is a state the studio already keeps, so a condition is a lookup rather than
// a second source of truth.
export interface TourStage {
  readonly hasMedia: boolean;
  readonly hasPlan: boolean;
  /** The preview is serving *this* session's project, so its tools are live. */
  readonly hasPreviewTools: boolean;
  readonly hasProject: boolean;
  // Something is already asking to be answered — a permission card, a wizard,
  // a folder that is gone. A tip must never compete with it.
  readonly isBlocked: boolean;
  readonly isPaneShown: boolean;
  readonly isRunning: boolean;
}

// A tip is available when the thing it points at is on screen and usable —
// which is also what guarantees its anchor exists.
export function isAvailable(tip: TourTip, stage: TourStage): boolean {
  if (!stage.hasProject || stage.isBlocked) {
    return false;
  }

  switch (tip.id) {
    case "composer":
      return true;
    case "preview-tools":
      return stage.hasPreviewTools;
    case "library":
      return stage.isPaneShown && stage.hasMedia;
    case "plan":
      return stage.hasPlan;
    default:
      return stage.isPaneShown && stage.isRunning;
  }
}

// One tip at a time, by construction: this answers with a single entry, so
// there is no queue to drain and nothing that can put two on screen at once.
export function nextTip(
  stage: TourStage,
  seen: readonly string[]
): TourTip | null {
  return (
    TOUR_TIPS.find(
      (tip) => !seen.includes(tip.id) && isAvailable(tip, stage)
    ) ?? null
  );
}
