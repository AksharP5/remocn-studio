import type { CalculateMetadataFunction } from "remotion";

interface Props {
  label: string;
}

export const computedMetadata: CalculateMetadataFunction<Props> = ({
  props,
}) => ({
  durationInFrames: 12,
  fps: 24,
  height: 100,
  props: { label: `${props.label}-resolved` },
  width: 200,
});

export const Computed: React.FC<Props> = ({ label }) => (
  <div
    style={{
      alignItems: "center",
      background: "#101014",
      color: "white",
      display: "flex",
      fontFamily: "Helvetica, Arial, sans-serif",
      fontSize: 18,
      height: "100%",
      justifyContent: "center",
      width: "100%",
    }}
  >
    {label}
  </div>
);
