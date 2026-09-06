import { describe, expect, it } from "vitest";
import {
  decodeBase64Url,
  encodeBase64Url,
  parseDeepLink,
} from "@/shared/deep-link";

const URL_HOSTILE = /[+/=]/;

const PROPS = {
  joinedAt: "2026-07-08T00:00:00.000Z",
  launchedAt: "2026-09-06T00:00:00.000Z",
  memberNumber: 128,
  name: "Zoë Álvarez",
  period: "year",
  purchasedAt: "2026-09-06T00:00:00.000Z",
};

// The exact shape the landing's Open in Studio button writes: base64url of the
// props' UTF-8 JSON, padding stripped.
function linkFor(props: unknown, template = "welcome-early-member") {
  return `remocn-studio://open-template?template=${template}&props=${encodeBase64Url(JSON.stringify(props))}`;
}

describe("parseDeepLink", () => {
  it("opens the welcome template with the props the link carries", () => {
    const link = parseDeepLink(linkFor(PROPS));

    expect(link).toEqual({
      ok: true,
      route: {
        props: PROPS,
        template: "welcome-early-member",
        type: "open-template",
      },
    });
  });

  it("reads the route from the path when the link puts a slash first", () => {
    const encoded = encodeBase64Url(JSON.stringify(PROPS));
    const link = parseDeepLink(
      `remocn-studio:///open-template?template=welcome-early-member&props=${encoded}`
    );

    expect(link.ok).toBe(true);
  });

  it("drops keys the template does not declare", () => {
    const link = parseDeepLink(linkFor({ ...PROPS, path: "/etc/passwd" }));

    expect(link.ok).toBe(true);
    expect(link.ok && link.route.props).not.toHaveProperty("path");
  });

  it("refuses a link for another scheme", () => {
    expect(parseDeepLink("https://remocn.studio/welcome")).toEqual({
      ok: false,
      reason: "This link is not a Remocn Studio link.",
    });
  });

  it("refuses text that is not a URL at all", () => {
    expect(parseDeepLink("open-template").ok).toBe(false);
  });

  it("refuses a route it does not have", () => {
    const link = parseDeepLink("remocn-studio://run?cmd=rm");

    expect(link).toEqual({
      ok: false,
      reason: "This link asks the studio to “run”, which it cannot do.",
    });
  });

  it("refuses a template outside the list, by name", () => {
    const link = parseDeepLink(linkFor(PROPS, "../../etc"));

    expect(link).toEqual({
      ok: false,
      reason: "This link names a template the studio does not have: ../../etc.",
    });
  });

  it("refuses a link with no template or no props", () => {
    expect(parseDeepLink("remocn-studio://open-template?props=e30").ok).toBe(
      false
    );
    expect(
      parseDeepLink(
        "remocn-studio://open-template?template=welcome-early-member"
      ).ok
    ).toBe(false);
  });

  it("refuses props that are not base64url or not JSON", () => {
    expect(
      parseDeepLink(
        "remocn-studio://open-template?template=welcome-early-member&props=%%%"
      )
    ).toEqual({
      ok: false,
      reason: "The props in this link could not be read.",
    });
    expect(
      parseDeepLink(
        `remocn-studio://open-template?template=welcome-early-member&props=${encodeBase64Url("{not json")}`
      )
    ).toEqual({
      ok: false,
      reason: "The props in this link could not be read.",
    });
  });

  it("refuses props the template's schema does not accept", () => {
    const missing = parseDeepLink(linkFor({ name: "Alex" }));
    const wrong = parseDeepLink(linkFor({ ...PROPS, memberNumber: -1 }));
    const period = parseDeepLink(linkFor({ ...PROPS, period: "week" }));

    for (const link of [missing, wrong, period]) {
      expect(link).toEqual({
        ok: false,
        reason: "The props in this link are not the ones the template expects.",
      });
    }
  });
});

describe("base64url", () => {
  it("round-trips text beyond latin-1", () => {
    const text = JSON.stringify({ name: "Зоя — Álvarez ✨" });

    expect(decodeBase64Url(encodeBase64Url(text))).toBe(text);
  });

  it("carries no padding and no URL-hostile characters", () => {
    const encoded = encodeBase64Url("ÿþý??>>");

    expect(encoded).not.toMatch(URL_HOSTILE);
  });

  it("refuses bytes that are not UTF-8", () => {
    expect(decodeBase64Url("_w")).toBeNull();
  });
});
