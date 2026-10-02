import { describe, expect, it } from "bun:test";
import { FEEDBACK_INTAKE_EMAIL, feedbackMailto } from "./feedback";

const BODY_PARAM = /body=([^&]*)/;

function bodyOf(url: string): string {
  const match = url.match(BODY_PARAM);
  if (match === null) {
    throw new Error("no body in the mailto url");
  }
  return decodeURIComponent(match[1] ?? "");
}

describe("feedbackMailto", () => {
  it("targets the intake address with an encoded subject", () => {
    const url = feedbackMailto({
      environment: "production",
      os: "15.5",
      provider: "Claude",
      version: "0.4.1",
    });

    expect(url.startsWith(`mailto:${FEEDBACK_INTAKE_EMAIL}?`)).toBe(true);
    expect(url).toContain(
      `subject=${encodeURIComponent("Remocn Studio feedback")}`
    );
  });

  it("carries every diagnostic it was given", () => {
    const body = bodyOf(
      feedbackMailto({
        environment: "production",
        os: "15.5",
        provider: "Claude",
        version: "0.4.1",
      })
    );

    expect(body).toContain("Remocn Studio 0.4.1 (production)");
    expect(body).toContain("macOS 15.5");
    expect(body).toContain("Agent: Claude");
    expect(body).toContain("attach");
  });

  it("omits the lines it cannot answer instead of writing unknowns", () => {
    const body = bodyOf(
      feedbackMailto({
        environment: null,
        os: null,
        provider: null,
        version: null,
      })
    );

    expect(body).not.toContain("macOS");
    expect(body).not.toContain("Agent:");
    expect(body).not.toContain("Remocn Studio (");
  });

  it("carries the Linux distribution without a macOS label", () => {
    const body = bodyOf(
      feedbackMailto(
        {
          environment: "production",
          os: "Omarchy 4.0.0",
          provider: "Codex",
          version: "1.0.0",
        },
        "linux"
      )
    );

    expect(body).toContain("Omarchy 4.0.0");
    expect(body).not.toContain("macOS");
  });

  it("names the build even when only the environment is known", () => {
    const body = bodyOf(
      feedbackMailto({
        environment: "development",
        os: null,
        provider: null,
        version: null,
      })
    );

    expect(body).toContain("Remocn Studio (development)");
  });
});
