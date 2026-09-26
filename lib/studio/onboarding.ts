export const ONBOARDING_CHAPTERS = [
  {
    body: "Click an element on the canvas and tune its color, size or timing. Studio writes the change into your code.",
    id: "inspect",
    label: "Inspect & edit",
    title: "Point at anything in the frame",
  },
  {
    body: "Capture the frame or drag over a part of it. It lands in your message, so the agent sees exactly what you mean.",
    id: "snapshot",
    label: "Snapshot",
    title: "Show, don’t describe",
  },
  {
    body: "Keep your own footage in the library, or search free photos and videos for the next scene.",
    id: "assets",
    label: "Assets & stock",
    title: "Your files and free stock, in one place",
  },
  {
    body: "Save an animation you like and use it in any video, or start from the built-in set: entry, emphasis, exit.",
    id: "components",
    label: "Components",
    title: "Reuse motion that works",
  },
  {
    body: "Import your DESIGN.md or set the colors by hand. Every new video picks them up.",
    id: "brand",
    label: "Project brand",
    title: "Every new video, on brand",
  },
  {
    body: "Pick a preset for YouTube, shorts or a feed, or choose the format, resolution and quality yourself.",
    id: "export",
    label: "Export",
    title: "Ship it anywhere",
  },
] as const;

export type OnboardingChapter = (typeof ONBOARDING_CHAPTERS)[number];
export type OnboardingChapterId = OnboardingChapter["id"];

export interface OnboardingProgress {
  chapter: OnboardingChapterId;
  dismissed: boolean;
}

export function onboardingChapter(id: unknown): OnboardingChapter {
  return (
    ONBOARDING_CHAPTERS.find((chapter) => chapter.id === id) ??
    ONBOARDING_CHAPTERS[0]
  );
}

export function onboardingProgress(
  value: string | undefined
): OnboardingProgress {
  try {
    const parsed: unknown = JSON.parse(value ?? "null");
    if (typeof parsed === "object" && parsed !== null) {
      const data = parsed as Record<string, unknown>;
      return {
        chapter: onboardingChapter(data.chapter).id,
        dismissed: data.dismissed === true,
      };
    }
  } catch {
    return { chapter: "inspect", dismissed: false };
  }
  return { chapter: "inspect", dismissed: false };
}
