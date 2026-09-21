import { expect, it, mock } from "bun:test";
import { act, render, screen } from "@testing-library/react";
import {
  StudioObjects,
  useStudioObject,
} from "../templates/remotion/src/lib/studio-objects-v2";
import { easingDocumentFixture } from "../test/fixtures/studio-document";

function Curve() {
  const object = useStudioObject("title");
  return (
    <output {...object.bind}>{object.easing("entryEasing").join(",")}</output>
  );
}

it("previews custom curves, ignores invalid domains, and restores the saved curve after rebuild", () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, "parent");
  const parent = { postMessage: mock() };
  Object.defineProperty(window, "parent", {
    configurable: true,
    value: parent,
  });
  const view = render(
    <StudioObjects document={easingDocumentFixture}>
      <Curve />
    </StudioObjects>
  );
  try {
    const generation = view.container.firstElementChild?.getAttribute(
      "data-studio-generation"
    );
    const send = (value: unknown) =>
      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              field: "entryEasing",
              generation,
              objectId: "title",
              source: "remocn-studio",
              type: "studio.draft",
              value,
            },
            source: parent as unknown as Window,
          })
        );
      });
    send([0.2, -0.4, 0.8, 1.4]);
    expect(screen.getByText("0.2,-0.4,0.8,1.4")).toBeTruthy();
    send([2, 0, 0.8, 1]);
    expect(screen.getByText("0.2,-0.4,0.8,1.4")).toBeTruthy();
    view.rerender(
      <StudioObjects document={structuredClone(easingDocumentFixture)}>
        <Curve />
      </StudioObjects>
    );
    expect(screen.getByText("0,0,0.58,1")).toBeTruthy();
  } finally {
    view.unmount();
    if (descriptor) {
      Object.defineProperty(window, "parent", descriptor);
    }
  }
});
