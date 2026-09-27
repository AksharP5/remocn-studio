export const WORKING_PHRASES = [
  "Storyboarding…",
  "Keyframing…",
  "Choreographing…",
  "Easing the curves…",
  "Timing the beats…",
  "Framing the shot…",
  "Blocking the scene…",
  "Tweening…",
  "Staging the entrance…",
  "Cutting on the beat…",
  "Color grading…",
  "Lining up the cuts…",
  "Dialing in the spring…",
  "Polishing transitions…",
  "Sketching frames…",
  "Setting the pace…",
] as const;

export function workingPhrase(step: number): string {
  const count = WORKING_PHRASES.length;
  const index = ((Math.trunc(step) % count) + count) % count;
  return WORKING_PHRASES[index] ?? WORKING_PHRASES[0];
}
