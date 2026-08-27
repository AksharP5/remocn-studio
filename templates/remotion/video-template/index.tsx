import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const meta = {
  durationInFrames: 150,
  fps: 30,
  height: 1080,
  width: 1920,
};

export default function Video() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rise = spring({
    config: { damping: 200 },
    durationInFrames: 30,
    fps,
    frame,
  });
  const fade = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        backgroundColor: "#141318",
        justifyContent: "center",
      }}
    >
      <h1
        style={{
          color: "white",
          fontFamily: "system-ui, sans-serif",
          fontSize: 96,
          fontWeight: 600,
          opacity: fade,
          transform: `translateY(${interpolate(rise, [0, 1], [24, 0])}px)`,
        }}
      >
        __VIDEO_NAME__
      </h1>
    </AbsoluteFill>
  );
}
