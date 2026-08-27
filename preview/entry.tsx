import "@remotion/studio/renderEntry";
import { Player, type PlayerRef } from "@remotion/player";
import { useContext, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Internals } from "remotion";
import { onCommand, post } from "./bridge";
import { connectHotReload } from "./hot";
import { armInspect, freezeInspect, type Stage as Spot } from "./inspect";
import { armSnapshot, type Frame } from "./snapshot";

const MAIN_ID = "Main";

connectHotReload();

Internals.waitForRoot((Root: React.FC) => {
  const element = Internals.getPreviewDomElement();
  if (element === null) {
    return;
  }
  createRoot(element).render(<Preview Root={Root} />);
});

function Preview({ Root }: { readonly Root: React.FC }) {
  return (
    <Internals.CompositionManagerProvider
      currentCompositionMetadata={null}
      initialCanvasContent={null}
      initialCompositions={[]}
      onlyRenderComposition={null}
    >
      <Internals.RemotionRootContexts
        audioEnabled={window.remotion_audioEnabled}
        audioLatencyHint={window.remotion_audioLatencyHint ?? "playback"}
        frameState={null}
        logLevel={window.remotion_logLevel ?? "info"}
        numberOfAudioTags={window.remotion_numberOfAudioTags ?? 0}
        previewSampleRate={window.remotion_previewSampleRate ?? null}
        videoEnabled={window.remotion_videoEnabled}
      >
        <Root />
        <Stage />
      </Internals.RemotionRootContexts>
    </Internals.CompositionManagerProvider>
  );
}

function Stage() {
  const { compositions } = useContext(Internals.CompositionManager);
  const picked = pick(compositions, askedId(), preferredId());
  const player = useRef<PlayerRef>(null);

  useEffect(() => {
    post(
      describe(
        picked,
        compositions.map((composition) => composition.id)
      )
    );
  }, [compositions, picked]);

  usePreviewCommands(player, {
    composition: picked?.id ?? null,
    fps: picked?.metadata?.fps ?? 30,
    height: picked?.metadata?.height ?? 0,
    width: picked?.metadata?.width ?? 0,
  });

  if (picked === null || picked.metadata === null) {
    return null;
  }

  const { component, defaultProps, durationInFrames, fps, height, width } =
    picked.metadata;

  return (
    <Player
      acknowledgeRemotionLicense
      component={component}
      compositionHeight={height}
      compositionWidth={width}
      controls
      durationInFrames={durationInFrames}
      fps={fps}
      inputProps={defaultProps}
      loop
      ref={player}
      style={{ height: "100%", width: "100%" }}
    />
  );
}

interface Playing {
  composition: string | null;
  fps: number;
  height: number;
  width: number;
}

function usePreviewCommands(
  player: React.RefObject<PlayerRef | null>,
  video: Playing
) {
  const playing = useRef(video);
  playing.current = video;

  const spot = useRef<Spot>({
    composition: () => playing.current.composition ?? "",
    fps: () => playing.current.fps,
    frame: () => player.current?.getCurrentFrame() ?? 0,
  });

  const frame = useRef<Frame>({
    composition: () => playing.current.composition ?? "",
    frame: () => player.current?.getCurrentFrame() ?? 0,
    height: () => playing.current.height,
    width: () => playing.current.width,
  });

  useEffect(
    () =>
      onCommand((command) => {
        if (command.type === "inspect") {
          if (command.armed) {
            player.current?.pause();
          }
          post({
            paused: player.current !== null,
            status: armInspect(command.armed, spot.current),
            type: "inspect",
          });
          return;
        }

        if (command.type === "snapshot") {
          if (command.armed) {
            player.current?.pause();
          }
          post({
            paused: player.current !== null,
            status: armSnapshot(command.armed, frame.current),
            type: "snapshot",
          });
          return;
        }

        if (command.type === "freeze") {
          freezeInspect(command.frozen);
          return;
        }

        player.current?.pause();
        player.current?.seekTo(command.frame);
      }),
    [player]
  );
}

// Two different signals, deliberately not merged. `asked` is the video the pane
// opened this page for, and a miss is a fact worth reporting; `preferred` is the
// basename of the opened folder, a guess from #226 whose miss is unremarkable.
function askedId(): string | null {
  return (window as unknown as { remocn_composition: string | null })
    .remocn_composition;
}

function preferredId(): string | null {
  return (window as unknown as { remocn_preferred: string | null })
    .remocn_preferred;
}

// The app draws its list of videos from rows it already has and reconciles it
// against this: the ids are the only thing that knows what the project really
// renders, and they cost nothing to send with the pick.
function describe(
  picked: ReturnType<typeof pick>,
  compositions: readonly string[]
) {
  const total = compositions.length;

  if (picked === null) {
    return {
      compositionId: null,
      compositions,
      reason: "none",
      total,
      type: "composition",
      unmeasured: false,
    };
  }

  return {
    // A missing video keeps its id in the message: the pane has to be able to
    // name what it asked for, and "unmeasured" is a different fact — a
    // composition that exists but computes its metadata.
    compositionId: picked.id,
    compositions,
    reason: picked.reason,
    total,
    type: "composition",
    unmeasured: picked.reason !== "missing" && picked.metadata === null,
  };
}

interface AnyComposition {
  component: React.FC;
  defaultProps?: Record<string, unknown>;
  durationInFrames: number | undefined;
  fps: number | undefined;
  height: number | undefined;
  id: string;
  width: number | undefined;
}

function pick(
  compositions: AnyComposition[],
  asked: string | null,
  preferred: string | null
) {
  if (compositions.length === 0) {
    return null;
  }

  if (asked !== null) {
    const byId = compositions.find((composition) => composition.id === asked);

    // Playing the neighbour instead is the one thing this must not do: the
    // pane asked for a video by name, and a silent substitution reads as the
    // wrong video rendering rather than as a video nothing registers.
    return byId === undefined
      ? { id: asked, metadata: null, reason: "missing" }
      : { id: byId.id, metadata: measured(byId), reason: "asked" };
  }

  const byFolder =
    preferred === null
      ? undefined
      : compositions.find((composition) => composition.id === preferred);

  if (byFolder !== undefined) {
    return { id: byFolder.id, metadata: measured(byFolder), reason: "folder" };
  }

  const main = compositions.find((composition) => composition.id === MAIN_ID);

  if (main !== undefined) {
    return { id: main.id, metadata: measured(main), reason: "main" };
  }

  const [first] = compositions;

  return { id: first.id, metadata: measured(first), reason: "first" };
}

function measured(composition: AnyComposition) {
  const { durationInFrames, fps, height, width } = composition;

  if (
    durationInFrames === undefined ||
    fps === undefined ||
    height === undefined ||
    width === undefined
  ) {
    return null;
  }

  return {
    component: composition.component,
    defaultProps: composition.defaultProps ?? {},
    durationInFrames,
    fps,
    height,
    width,
  };
}
