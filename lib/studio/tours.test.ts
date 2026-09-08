import { describe, expect, it } from "bun:test";
import {
  isAvailable,
  nextTip,
  TOUR_TIPS,
  type TourId,
  type TourStage,
  tourAnchor,
} from "@/lib/studio/tours";

// Nothing is available on a studio with no project open, which is the point:
// the tour is about "what can this thing do", never about getting started.
const IDLE: TourStage = {
  hasMedia: false,
  hasPlan: false,
  hasPreviewTools: false,
  hasProject: false,
  isBlocked: false,
  isPaneShown: false,
  isRunning: false,
};

const OPEN: TourStage = { ...IDLE, hasProject: true };

function tipOf(id: TourId) {
  const found = TOUR_TIPS.find((tip) => tip.id === id);
  if (found === undefined) {
    throw new Error(`no tip called ${id}`);
  }
  return found;
}

describe("isAvailable", () => {
  const table: readonly {
    id: TourId;
    is: boolean;
    stage: TourStage;
    when: string;
  }[] = [
    { id: "composer", is: false, stage: IDLE, when: "no project is open" },
    { id: "composer", is: true, stage: OPEN, when: "a project is open" },
    {
      id: "preview-tools",
      is: false,
      stage: OPEN,
      when: "the preview has not compiled yet",
    },
    {
      id: "preview-tools",
      is: true,
      stage: { ...OPEN, hasPreviewTools: true },
      when: "the preview is playing",
    },
    {
      id: "snapshot",
      is: false,
      stage: OPEN,
      when: "the preview has not compiled yet",
    },
    {
      id: "snapshot",
      is: true,
      stage: { ...OPEN, hasPreviewTools: true },
      when: "the preview is playing",
    },
    {
      id: "assets",
      is: false,
      stage: { ...OPEN, hasMedia: true },
      when: "the pane it points at is hidden",
    },
    {
      id: "assets",
      is: false,
      stage: { ...OPEN, isPaneShown: true },
      when: "no media has been attached yet",
    },
    {
      id: "assets",
      is: true,
      stage: { ...OPEN, hasMedia: true, isPaneShown: true },
      when: "a picture or a clip is in the message",
    },
    {
      id: "components",
      is: false,
      stage: OPEN,
      when: "the pane it points at is hidden",
    },
    {
      id: "components",
      is: true,
      stage: { ...OPEN, isPaneShown: true },
      when: "the pane is on screen",
    },
    {
      id: "plan",
      is: false,
      stage: OPEN,
      when: "the agent has written no plan",
    },
    {
      id: "plan",
      is: true,
      stage: { ...OPEN, hasPlan: true },
      when: "a plan is on screen",
    },
    {
      id: "sessions",
      is: false,
      stage: { ...OPEN, isPaneShown: true },
      when: "nothing is running",
    },
    {
      id: "sessions",
      is: true,
      stage: { ...OPEN, isPaneShown: true, isRunning: true },
      when: "a turn is running",
    },
  ];

  for (const row of table) {
    it(`${row.is ? "offers" : "withholds"} ${row.id} when ${row.when}`, () => {
      expect(isAvailable(tipOf(row.id), row.stage)).toBe(row.is);
    });
  }

  // A permission card, a wizard, a folder that is gone: something is already
  // asking to be answered, and a tip must never compete with it.
  it("withholds every tip while something else is being asked", () => {
    const busy: TourStage = {
      hasMedia: true,
      hasPlan: true,
      hasPreviewTools: true,
      hasProject: true,
      isBlocked: true,
      isPaneShown: true,
      isRunning: true,
    };

    for (const tip of TOUR_TIPS) {
      expect(isAvailable(tip, busy)).toBe(false);
    }
  });
});

describe("nextTip", () => {
  it("answers with one tip even when several features are available", () => {
    const everything: TourStage = {
      hasMedia: true,
      hasPlan: true,
      hasPreviewTools: true,
      hasProject: true,
      isBlocked: false,
      isPaneShown: true,
      isRunning: true,
    };

    expect(nextTip(everything, [])?.id).toBe("composer");
  });

  it("moves on to the next one once a tip has been answered", () => {
    const everything: TourStage = {
      hasMedia: true,
      hasPlan: true,
      hasPreviewTools: true,
      hasProject: true,
      isBlocked: false,
      isPaneShown: true,
      isRunning: true,
    };

    expect(nextTip(everything, ["composer"])?.id).toBe("preview-tools");
    expect(nextTip(everything, ["composer", "preview-tools"])?.id).toBe(
      "snapshot"
    );
    expect(
      nextTip(everything, ["composer", "preview-tools", "snapshot"])?.id
    ).toBe("assets");
  });

  it("skips a tip whose feature is not available, without stopping there", () => {
    expect(nextTip({ ...OPEN, hasPlan: true }, ["composer"])?.id).toBe("plan");
  });

  it("answers with nothing once every tip has been seen", () => {
    const seen = TOUR_TIPS.map((tip) => tip.id);
    expect(nextTip({ ...OPEN, hasPlan: true }, seen)).toBeNull();
  });

  // An id nobody ships is ignored rather than shifting the list — the stored
  // list outlives any one version of the catalog.
  it("ignores ids the catalog no longer carries", () => {
    expect(nextTip(OPEN, ["a-tip-that-was-removed"])?.id).toBe("composer");
  });
});

describe("tourAnchor", () => {
  it("names the attribute the anchor carries", () => {
    expect(tourAnchor("composer")).toBe('[data-tour="composer"]');
  });
});
