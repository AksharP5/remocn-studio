import { describe, expect, it } from "bun:test";
import { act, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { createRef } from "react";
import { CanvasStage } from "@/components/studio/canvas-preview";
import {
  type PreviewCameraControl,
  usePreviewCamera,
} from "@/hooks/use-preview-camera";

type Metadata = ComponentProps<typeof CanvasStage>["metadata"];

const VIDEO = {
  durationInFrames: 90,
  fps: 30,
  height: 1080,
  width: 1920,
} as Metadata;

function mount() {
  const view: { current: PreviewCameraControl | null } = { current: null };
  const nativeStage = createRef<HTMLDivElement>();
  function Harness() {
    const camera = usePreviewCamera(VIDEO, null, () => undefined);
    view.current = camera;
    return (
      <div ref={camera.viewport}>
        <CanvasStage
          camera={camera}
          metadata={VIDEO}
          nativeStage={nativeStage}
          shown
          watching={false}
        />
      </div>
    );
  }
  render(<Harness />);
  const stage = nativeStage.current?.parentElement as HTMLElement;
  const toggle = () =>
    act(() => {
      view.current?.toggleOutside();
    });
  return { stage, toggle };
}

describe("CanvasStage", () => {
  it("lets content outside the frame show while it is dimmed", () => {
    const { stage } = mount();

    expect(stage).not.toHaveClass("overflow-clip");
  });

  it("clips the video to the frame while content outside is hidden", () => {
    const { stage, toggle } = mount();

    toggle();
    expect(stage).toHaveClass("overflow-clip");

    toggle();
    expect(stage).not.toHaveClass("overflow-clip");
  });
});
