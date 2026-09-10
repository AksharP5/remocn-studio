import { useCallback, useEffect, useRef, useState } from "react";
import { cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";

export const Surface: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [handle] = useState(() => delayRender("WebGL2 probe"));

  const draw = useCallback(() => {
    const element = canvas.current;

    if (element === null) {
      return;
    }

    const gl = element.getContext("webgl2");

    if (gl === null) {
      cancelRender(
        new Error('canvas.getContext("webgl2") returned null')
      );
      return;
    }

    const step = frame / Math.max(1, durationInFrames - 1);

    gl.viewport(0, 0, element.width, element.height);
    gl.clearColor(step, 0.5, 1 - step, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.finish();

    continueRender(handle);
  }, [durationInFrames, frame, handle]);

  useEffect(draw, [draw]);

  return (
    <canvas
      height={180}
      ref={canvas}
      style={{ height: "100%", width: "100%" }}
      width={320}
    />
  );
};
