import { Exit, Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  PROJECT_TEMPLATES,
  templateProjectName,
  WelcomeEarlyMemberProps,
} from "@/shared/templates";
import {
  welcomeEarlyMemberDefaults,
  welcomeEarlyMemberSchema,
} from "../templates/remotion/video-templates/welcome-early-member/schema";

const decode = Schema.decodeUnknownExit(WelcomeEarlyMemberProps);

const CASES: readonly unknown[] = [
  welcomeEarlyMemberDefaults,
  { ...welcomeEarlyMemberDefaults, period: "month" },
  { ...welcomeEarlyMemberDefaults, period: null },
  { ...welcomeEarlyMemberDefaults, name: "" },
  { ...welcomeEarlyMemberDefaults, memberNumber: 0 },
  { ...welcomeEarlyMemberDefaults, memberNumber: -3 },
  { ...welcomeEarlyMemberDefaults, memberNumber: 1.5 },
  { ...welcomeEarlyMemberDefaults, memberNumber: "128" },
  { ...welcomeEarlyMemberDefaults, period: "week" },
  { ...welcomeEarlyMemberDefaults, period: undefined },
  { ...welcomeEarlyMemberDefaults, joinedAt: 1_720_000_000_000 },
  { name: "Alex" },
  null,
  "Alex",
];

describe("the welcome template's props", () => {
  // The composition validates with zod inside the Remotion project; the link
  // is validated with Effect Schema in the app. One set of rules, two
  // spellings, and this is what keeps them the same rules.
  it("are accepted and refused exactly as the composition's own zod schema decides", () => {
    for (const input of CASES) {
      const zod = welcomeEarlyMemberSchema.safeParse(input).success;
      const effect = Exit.isSuccess(decode(input));

      expect(effect, JSON.stringify(input)).toBe(zod);
    }
  });

  it("ship a folder per template", () => {
    expect(PROJECT_TEMPLATES).toEqual(["welcome-early-member"]);
  });
});

describe("templateProjectName", () => {
  it("names the project after the person", () => {
    expect(
      templateProjectName("welcome-early-member", {
        ...welcomeEarlyMemberDefaults,
        name: "  Alex Rivera ",
      })
    ).toBe("Welcome — Alex Rivera");
  });

  it("still has a name when the account has none", () => {
    expect(
      templateProjectName("welcome-early-member", {
        ...welcomeEarlyMemberDefaults,
        name: "   ",
      })
    ).toBe("Welcome — Early member");
  });
});
