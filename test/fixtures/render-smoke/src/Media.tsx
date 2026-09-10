import { Audio, OffthreadVideo, staticFile } from "remotion";

export const Media: React.FC = () => (
  <>
    <OffthreadVideo src={staticFile("clip.mp4")} />
    <Audio src={staticFile("tone.wav")} />
  </>
);
