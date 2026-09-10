import { useCurrentFrame, useVideoConfig } from "remotion";

export const Dom: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const step = Math.round((frame / Math.max(1, durationInFrames - 1)) * 255);

  return (
    <div
      style={{
        alignItems: "center",
        background: `rgb(${step}, 24, ${255 - step})`,
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <svg height={80} viewBox="0 0 80 80" width={80}>
        <title>a circle that grows</title>
        <circle cx={40} cy={40} fill="white" r={8 + frame * 4} />
      </svg>
      <span
        style={{
          color: "white",
          fontFamily: "Helvetica, Arial, sans-serif",
          fontSize: 32,
        }}
      >
        {frame}
      </span>
    </div>
  );
};
