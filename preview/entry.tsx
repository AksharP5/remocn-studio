import "@remotion/studio/renderEntry";
import { Player, type PlayerRef } from "@remotion/player";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  const resolved = useResolvedMetadata(picked?.composition ?? null);

  useEffect(() => {
    post(
      describe(
        picked,
        resolved,
        compositions.map((composition) => composition.id)
      )
    );
  }, [compositions, picked, resolved]);

  usePreviewCommands(player, playingOf(picked?.id ?? null, resolved.metadata));

  const mounted = resolved.metadata === null ? null : (picked?.id ?? null);

  usePlayhead(player, mounted);

  if (picked === null || resolved.metadata === null) {
    return null;
  }

  return <InteractivePlayer metadata={resolved.metadata} player={player} />;
}

function playingOf(
  composition: string | null,
  metadata: ResolvedMetadata | null
): Playing {
  if (metadata === null) {
    return { composition, durationInFrames: 0, fps: 30, height: 0, width: 0 };
  }

  return {
    composition,
    durationInFrames: metadata.durationInFrames,
    fps: metadata.fps,
    height: metadata.height,
    width: metadata.width,
  };
}

export interface ResolvedMetadata {
  component: React.FC;
  defaultProps: Record<string, unknown>;
  durationInFrames: number;
  fps: number;
  height: number;
  props: Record<string, unknown>;
  width: number;
}

interface Resolution {
  message: string | null;
  metadata: ResolvedMetadata | null;
  state: "failed" | "loading" | "ready";
}

const LOADING: Resolution = { message: null, metadata: null, state: "loading" };

function useResolvedMetadata(composition: AnyComposition | null): Resolution {
  const [resolution, setResolution] = useState<Resolution>(LOADING);

  useEffect(() => {
    if (composition === undefined || composition === null) {
      setResolution(LOADING);
      return;
    }

    const still = staticOf(composition);

    if (typeof composition.calculateMetadata !== "function") {
      setResolution(
        still === null
          ? {
              message: `${composition.id} declares no size, and it has no calculateMetadata to give one`,
              metadata: null,
              state: "failed",
            }
          : { message: null, metadata: still, state: "ready" }
      );
      return;
    }

    const controller = new AbortController();
    let live = true;

    setResolution(LOADING);

    askForMetadata(composition, controller.signal)
      .then((video) => {
        if (!live) {
          return;
        }
        setResolution({
          message: null,
          metadata: {
            component: composition.component as unknown as React.FC,
            defaultProps: video.defaultProps ?? {},
            durationInFrames: video.durationInFrames,
            fps: video.fps,
            height: video.height,
            props: video.props ?? {},
            width: video.width,
          },
          state: "ready",
        });
      })
      .catch((cause: unknown) => {
        if (!live) {
          return;
        }
        setResolution({
          message: messageOf(cause),
          metadata: null,
          state: "failed",
        });
      });

    return () => {
      live = false;
      controller.abort();
    };
  }, [composition]);

  return resolution;
}

interface VideoConfigLike {
  defaultProps?: Record<string, unknown>;
  durationInFrames: number;
  fps: number;
  height: number;
  props?: Record<string, unknown>;
  width: number;
}

async function askForMetadata(
  composition: AnyComposition,
  signal: AbortSignal
): Promise<VideoConfigLike> {
  const resolve = (
    Internals as unknown as {
      resolveVideoConfig?: (input: Record<string, unknown>) => unknown;
    }
  ).resolveVideoConfig;

  if (typeof resolve !== "function") {
    const still = staticOf(composition);

    if (still === null) {
      throw new Error(
        "this Remotion cannot resolve calculateMetadata outside its own Studio"
      );
    }

    return still;
  }

  return (await resolve({
    calculateMetadata: composition.calculateMetadata ?? null,
    compositionDurationInFrames: composition.durationInFrames ?? null,
    compositionFps: composition.fps ?? null,
    compositionHeight: composition.height ?? null,
    compositionId: composition.id,
    compositionWidth: composition.width ?? null,
    defaultProps: composition.defaultProps ?? {},
    inputProps: {},
    signal,
  })) as VideoConfigLike;
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function staticOf(composition: AnyComposition): ResolvedMetadata | null {
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
    component: composition.component as unknown as React.FC,
    defaultProps: composition.defaultProps ?? {},
    durationInFrames,
    fps,
    height,
    props: composition.defaultProps ?? {},
    width,
  };
}

function InteractivePlayer({
  metadata,
  player,
}: {
  readonly metadata: ResolvedMetadata;
  readonly player: React.RefObject<PlayerRef | null>;
}) {
  const { component, durationInFrames, fps, height, width } = metadata;
  const inputProps = metadata.props;
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
      inputProps={inputProps}
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
  resolved: Resolution,
  compositions: readonly string[]
) {
  const total = compositions.length;

  if (picked === null) {
    return {
      compositionId: null,
      compositions,
      metadata: null,
      reason: "none",
      total,
      trouble: null,
      type: "composition",
      unmeasured: false,
    };
  }

  const { metadata } = resolved;

  return {
    // A missing video keeps its id in the message: the pane has to be able to
    // name what it asked for, and "unmeasured" is a different fact — a
    // composition that exists but computes its metadata.
    compositionId: picked.id,
    compositions,
    // The numbers the Player is really mounted with, calculateMetadata
    // resolved. The export measures the same composition in its own browser,
    // so this is what the dialog can promise a size from.
    metadata:
      metadata === null
        ? null
        : {
            durationInFrames: metadata.durationInFrames,
            fps: metadata.fps,
            height: metadata.height,
            width: metadata.width,
          },
    reason: picked.reason,
    total,
    trouble: resolved.state === "failed" ? resolved.message : null,
    type: "composition",
    unmeasured: picked.reason !== "missing" && metadata === null,
  };
}

interface AnyComposition {
  calculateMetadata?: ((input: unknown) => unknown) | null;
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
      ? { composition: null, id: asked, reason: "missing" }
      : { composition: byId, id: byId.id, reason: "asked" };
  }

  const byFolder =
    preferred === null
      ? undefined
      : compositions.find((composition) => composition.id === preferred);

  if (byFolder !== undefined) {
    return { composition: byFolder, id: byFolder.id, reason: "folder" };
  }

  const main = compositions.find((composition) => composition.id === MAIN_ID);

  if (main !== undefined) {
    return { composition: main, id: main.id, reason: "main" };
  }

  const [first] = compositions;

  return { composition: first, id: first.id, reason: "first" };
}
