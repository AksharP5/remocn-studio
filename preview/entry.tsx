import "@remotion/studio/renderEntry";
import { Player, type PlayerRef } from "@remotion/player";
import { useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Internals } from "remotion";
import { onCommand, type PreviewCommand, post } from "./bridge";
import { connectHotReload } from "./hot";
import {
  armInspect,
  clearSelection,
  highlightTarget,
  repaint,
  type Stage as Spot,
} from "./inspect";
import { InteractivityRuntime } from "./interactivity";
import { releaseDetachedMedia } from "./media-release";
import { armSnapshot, type Frame } from "./snapshot";
import { applyStatuses, clearTuning, tune } from "./tuning-runtime";

const MAIN_ID = "Main";

connectHotReload(forget);

function forget(): void {
  clearSelection();
  clearTuning();
}

Internals.waitForRoot((Root: React.FC) => {
  const element = Internals.getPreviewDomElement();
  if (element === null) {
    return;
  }
  // For the life of the page: every scene mounts inside this element, and a
  // clip that leaves it must not keep its decoded frames in the GPU process.
  releaseDetachedMedia(element);
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
    durationInFrames: picked?.metadata?.durationInFrames ?? 0,
    fps: picked?.metadata?.fps ?? 30,
    height: picked?.metadata?.height ?? 0,
    width: picked?.metadata?.width ?? 0,
  });

  const mounted =
    picked === null || picked.metadata === null ? null : picked.id;

  usePlayhead(player, mounted);

  if (picked === null || picked.metadata === null) {
    return null;
  }

  return <InteractivePlayer metadata={picked.metadata} player={player} />;
}

function InteractivePlayer({
  metadata,
  player,
}: {
  readonly metadata: NonNullable<ReturnType<typeof measured>>;
  readonly player: React.RefObject<PlayerRef | null>;
}) {
  const { component, defaultProps, durationInFrames, fps, height, width } =
    metadata;
  const frame = useCallback(
    () => player.current?.getCurrentFrame() ?? 0,
    [player]
  );
  const interactiveComponent = useMemo(() => {
    const Composition = component;

    return function InteractiveComposition(props: Record<string, unknown>) {
      return (
        <InteractivityRuntime frame={frame}>
          <Composition {...props} />
        </InteractivityRuntime>
      );
    };
  }, [component, frame]);

  return (
    <Player
      acknowledgeRemotionLicense
      component={interactiveComponent}
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
  durationInFrames: number;
  fps: number;
  height: number;
  width: number;
}

function usePlayhead(
  player: React.RefObject<PlayerRef | null>,
  mounted: string | null
) {
  useEffect(() => {
    const ref = player.current;

    if (ref === null || mounted === null) {
      return;
    }

    let queued = 0;

    const announce = (playing: boolean) => {
      post({ frame: ref.getCurrentFrame(), playing, type: "playhead" });
    };

    const onFrame = () => {
      repaint();

      if (queued !== 0) {
        return;
      }

      queued = requestAnimationFrame(() => {
        queued = 0;
        announce(ref.isPlaying());
      });
    };

    const onPlay = () => announce(true);
    const onPause = () => announce(false);

    ref.addEventListener("frameupdate", onFrame);
    ref.addEventListener("play", onPlay);
    ref.addEventListener("pause", onPause);
    announce(ref.isPlaying());

    return () => {
      if (queued !== 0) {
        cancelAnimationFrame(queued);
      }

      ref.removeEventListener("frameupdate", onFrame);
      ref.removeEventListener("play", onPlay);
      ref.removeEventListener("pause", onPause);
    };
  }, [mounted, player]);
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
    video: () => ({
      durationInFrames: playing.current.durationInFrames,
      fps: playing.current.fps,
      height: playing.current.height,
      width: playing.current.width,
    }),
  });

  const frame = useRef<Frame>({
    composition: () => playing.current.composition ?? "",
    frame: () => player.current?.getCurrentFrame() ?? 0,
    height: () => playing.current.height,
    width: () => playing.current.width,
  });

  const replaying = useRef<(() => void) | null>(null);

  useEffect(
    () =>
      onCommand((command) => {
        if (inspectOrSnapshot(command, player, spot.current, frame.current)) {
          return;
        }

        if (playback(command, player, replaying)) {
          return;
        }

        if (command.type === "highlight") {
          highlightTarget(command.targetId, command.open);
          return;
        }

        if (command.type === "tune.set" || command.type === "tune.reset") {
          const result = tune(command);
          post({
            error: result.error,
            ok: result.ok,
            requestId: command.requestId,
            type: "tune.result",
          });
          return;
        }

        replaying.current?.();
        replaying.current = null;
        player.current?.pause();
        player.current?.seekTo(command.frame);
      }),
    [player]
  );
}

function playback(
  command: PreviewCommand,
  player: React.RefObject<PlayerRef | null>,
  replaying: React.RefObject<(() => void) | null>
): boolean {
  if (command.type === "pause") {
    replaying.current?.();
    replaying.current = null;
    player.current?.pause();
    return true;
  }

  if (command.type === "replay") {
    startReplay(player.current, command.from, command.until, replaying);
    return true;
  }

  if (command.type === "tuning.statuses") {
    applyStatuses(command.targets);
    return true;
  }

  return false;
}

function startReplay(
  ref: PlayerRef | null,
  at: number,
  until: number,
  replaying: React.RefObject<(() => void) | null>
): void {
  replaying.current?.();
  replaying.current = null;

  if (ref === null) {
    return;
  }

  ref.pause();
  ref.seekTo(at);

  if (at >= until) {
    return;
  }

  const settle = ({ detail }: { detail: { frame: number } }) => {
    if (detail.frame < until) {
      return;
    }

    replaying.current?.();
    replaying.current = null;
    ref.pause();
    ref.seekTo(until);
  };

  replaying.current = () => ref.removeEventListener("frameupdate", settle);
  ref.addEventListener("frameupdate", settle);
  ref.play();
}

function inspectOrSnapshot(
  command: PreviewCommand,
  player: React.RefObject<PlayerRef | null>,
  spot: Spot,
  frame: Frame
): boolean {
  if (command.type === "inspect") {
    if (command.armed) {
      player.current?.pause();
    }
    post({
      paused: player.current !== null,
      status: armInspect(command.armed, spot),
      type: "inspect",
    });
    return true;
  }

  if (command.type === "snapshot") {
    if (command.armed) {
      player.current?.pause();
    }
    post({
      paused: player.current !== null,
      status: armSnapshot(command.armed, frame),
      type: "snapshot",
    });
    return true;
  }

  return false;
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
