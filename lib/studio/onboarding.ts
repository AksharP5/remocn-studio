export const ONBOARDING_CHAPTERS = [
  { id: "inspect", label: "Inspect & edit" },
  { id: "snapshot", label: "Snapshot" },
  { id: "assets", label: "Assets & stock" },
  { id: "components", label: "Components" },
  { id: "brand", label: "Project brand" },
  { id: "export", label: "Export" },
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
