import { Composition, Still } from "remotion";
import { Computed, computedMetadata } from "./Computed";
import { Dom } from "./Dom";
import { Media } from "./Media";
import { Surface } from "./Surface";

export const Root: React.FC = () => (
  <>
    <Composition
      component={Dom}
      durationInFrames={6}
      fps={30}
      height={180}
      id="Dom"
      width={320}
    />
    <Composition
      component={Surface}
      durationInFrames={6}
      fps={30}
      height={180}
      id="WebGL"
      width={320}
    />
    <Composition
      component={Dom}
      durationInFrames={6}
      fps={30}
      height={181}
      id="Odd"
      width={321}
    />
    <Composition
      calculateMetadata={computedMetadata}
      component={Computed}
      defaultProps={{ label: "computed" }}
      durationInFrames={1}
      fps={1}
      height={1}
      id="Computed"
      width={1}
    />
    <Composition
      component={Media}
      durationInFrames={30}
      fps={30}
      height={180}
      id="Media"
      width={320}
    />
    <Composition
      component={Dom}
      durationInFrames={30}
      fps={30}
      height={180}
      id="Clip"
      width={320}
    />
    <Still component={Dom} height={180} id="OneFrame" width={320} />
  </>
);
