import { describe, expect, it } from "bun:test";
import { WORKING_PHRASES, workingPhrase } from "@/lib/studio/working-phrases";

describe("workingPhrase", () => {
  it("walks the phrases in order and wraps around", () => {
    expect(workingPhrase(0)).toBe(WORKING_PHRASES[0]);
    expect(workingPhrase(1)).toBe(WORKING_PHRASES[1]);
    expect(workingPhrase(WORKING_PHRASES.length)).toBe(WORKING_PHRASES[0]);
  });

  it("answers a phrase for any step, negative or fractional", () => {
    expect(WORKING_PHRASES).toContain(workingPhrase(-1));
    expect(WORKING_PHRASES).toContain(workingPhrase(2.7));
  });

  it("never names the video as a composition", () => {
    for (const phrase of WORKING_PHRASES) {
      expect(phrase.toLowerCase()).not.toContain("composition");
    }
  });
});
