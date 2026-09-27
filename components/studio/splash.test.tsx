import { describe, expect, it } from "bun:test";
import { render } from "@testing-library/react";
import { SplashScreen } from "@/components/studio/splash";

const ignoreAnimation = () => undefined;

describe("SplashScreen", () => {
  it("renders the shared glyph as a drawable path", () => {
    const { container } = render(
      <SplashScreen
        isReduced={false}
        onAnimationEnd={ignoreAnimation}
        phase="drawing"
      />
    );

    expect(container.querySelector("[data-splash] path")).toHaveAttribute(
      "pathLength",
      "1"
    );
  });

  it("records the reduced-motion rendering mode", () => {
    const { container } = render(
      <SplashScreen
        isReduced
        onAnimationEnd={ignoreAnimation}
        phase="holding"
      />
    );

    expect(container.querySelector("[data-splash]")).toHaveAttribute(
      "data-reduced-motion",
      "true"
    );
  });

  it("targets the exit scale at the logo instead of the full-screen surface", () => {
    const { container } = render(
      <SplashScreen
        isReduced={false}
        onAnimationEnd={ignoreAnimation}
        phase="leaving"
      />
    );

    expect(container.querySelector("[data-splash]")).toHaveClass(
      "splash-surface"
    );
    expect(container.querySelector("[data-splash-lockup]")).toHaveClass(
      "splash-lockup"
    );
  });
});
