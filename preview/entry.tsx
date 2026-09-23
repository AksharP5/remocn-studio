import "@remotion/studio/renderEntry";
import { createRoot } from "react-dom/client";
import { Internals } from "remotion";
import { connectHotReload } from "./hot";
import { releaseDetachedMedia } from "./media-release";
import { configurePlayback, Preview } from "./player-runtime";

const forget = configurePlayback((window as unknown as { remocn_root: string }).remocn_root);
connectHotReload(forget);
Internals.waitForRoot((Root: React.FC) => {
  const element = Internals.getPreviewDomElement();
  if (element === null) return;
  releaseDetachedMedia(element);
  createRoot(element).render(<Preview Root={Root} />);
});
