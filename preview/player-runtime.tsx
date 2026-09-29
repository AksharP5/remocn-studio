import { Player, PlayerInternals, type PlayerRef } from "@remotion/player";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Internals } from "remotion";
import { onCommand, type PreviewCommand, post } from "./bridge";
import {
  describe,
  pick,
  type ResolvedMetadata,
  useResolvedMetadata,
} from "./composition";
import { hide, reveal } from "./hidden";
import {
  armInspect,
  clearSelection,
  dismissSelection,
  highlightManaged,
  highlightTarget,
  hoverManaged,
  repaint,
  type Stage as Spot,
} from "./inspect";
import { InteractivityRuntime } from "./interactivity";
import { type PlaybackPosition, playbackPositions } from "./playback-position";
import { usePlaybackRate } from "./playback-rate";
import { useSceneObserver } from "./scenes-report";
import { armSnapshot, type Frame } from "./snapshot";
import { nativeSurface } from "./surface";
import { usePlayerTransport } from "./transport";
import { applyStatuses, clearTuning, tune } from "./tuning-runtime";

export interface PlaybackHooks {
  initial: PlaybackPosition | null;
  onPlayer: (
    player: PlayerRef | null,
    position: PlaybackPosition,
    durationInFrames: number
  ) => void;
  onUnplayable: () => void;
}

let positions: ReturnType<typeof playbackPositions>;
let hooks: PlaybackHooks | null = null;

export function configurePlayback(
  project: string,
  playback: PlaybackHooks | null = null
) {
  positions = playbackPositions(window.sessionStorage, project);
  hooks = playback;
  return () => {
    hooks = null;
    positions.persist();
    clearSelection();
    clearTuning();
  };
}

export function Preview({ Root }: { readonly Root: React.FC }) {
  return (
    <Internals.CompositionManagerProvider
      currentCompositionMetadata={null}
      initialCanvasContent={null}
      initialCompositions={[]}
      onlyRenderComposition={null}
    >
      <Internals.RemotionRootContexts
        audioEnabled={window.remotion_audioEnabled ?? true}
        audioLatencyHint={window.remotion_audioLatencyHint ?? "playback"}
        frameState={null}
        logLevel={window.remotion_logLevel ?? "info"}
        numberOfAudioTags={window.remotion_numberOfAudioTags ?? 0}
        previewSampleRate={window.remotion_previewSampleRate ?? null}
        videoEnabled={window.remotion_videoEnabled ?? true}
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
  usePlayerFailure(player, mounted);

  const unplayable =
    resolved.state === "failed" || (compositions.length > 0 && picked === null);
  useEffect(() => {
    if (unplayable) {
      hooks?.onUnplayable();
    }
  }, [unplayable]);

  if (picked === null || resolved.metadata === null) {
    return null;
  }

  return (
    <InteractivePlayer
      composition={picked.id}
      key={picked.id}
      metadata={resolved.metadata}
      player={player}
    />
  );
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

function InteractivePlayer({
  composition,
  metadata,
  player,
}: {
  readonly composition: string;
  readonly metadata: ResolvedMetadata;
  readonly player: React.RefObject<PlayerRef | null>;
}) {
  const { component, durationInFrames, fps, height, width } = metadata;
  const [position] = useState(
    () => hooks?.initial ?? positions.restore(composition, durationInFrames)
  );
  const inputProps = metadata.props;

  useEffect(() => {
    hooks?.onPlayer(player.current, position, durationInFrames);
    return () => hooks?.onPlayer(null, position, durationInFrames);
  }, [durationInFrames, player, position]);
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
  const observeSequences = useSceneObserver(composition, durationInFrames);
  const SequenceObserver = (
    PlayerInternals as {
      TimelineSequenceObserverContext?: React.Context<
        ((sequences: readonly unknown[]) => void) | null
      >;
    }
  ).TimelineSequenceObserverContext;
  const playbackRate = usePlaybackRate();

  const rendered = (
    <Player
      acknowledgeRemotionLicense
      autoPlay={hooks === null && position.playing}
      clickToPlay={false}
      component={interactiveComponent}
      compositionHeight={height}
      compositionWidth={width}
      controls={false}
      doubleClickToFullscreen={false}
      durationInFrames={durationInFrames}
      errorFallback={drawNothing}
      fps={fps}
      initialFrame={Math.max(
        0,
        Math.min(Math.round(position.frame), durationInFrames - 1)
      )}
      inputProps={inputProps}
      loop
      numberOfSharedAudioTags={0}
      overflowVisible={hooks !== null}
      playbackRate={playbackRate}
      ref={player}
      spaceKeyToPlayOrPause={false}
      style={{ height: "100%", width: "100%" }}
    />
  );

  return SequenceObserver ? (
    <SequenceObserver.Provider value={observeSequences}>
      {rendered}
    </SequenceObserver.Provider>
  ) : (
    rendered
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
      const position = { frame: ref.getCurrentFrame(), playing };
      positions.remember(mounted, position);
      post({ ...position, type: "playhead" });
    };

    const onFrame = () => {
      positions.remember(mounted, {
        frame: ref.getCurrentFrame(),
        playing: ref.isPlaying(),
      });
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

const RENDER_FAILED =
  "The video could not render. Fix the project, then retry the preview.";

function drawNothing() {
  return null;
}

function usePlayerFailure(
  player: React.RefObject<PlayerRef | null>,
  mounted: string | null
) {
  useEffect(() => {
    const ref = player.current;

    if (ref === null || mounted === null) {
      return;
    }

    const onError = () =>
      post({ message: RENDER_FAILED, type: "native.error" });

    ref.addEventListener("error", onError);

    return () => ref.removeEventListener("error", onError);
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
    pause: () => {
      replaying.current?.();
      replaying.current = null;
      player.current?.pause();
    },
    seek: (at: number) => {
      replaying.current?.();
      replaying.current = null;
      player.current?.pause();
      player.current?.seekTo(
        Math.max(
          0,
          Math.min(playing.current.durationInFrames - 1, Math.round(at))
        )
      );
    },
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
  const cancelReplay = useCallback(() => {
    replaying.current?.();
    replaying.current = null;
  }, []);

  usePlayerTransport(
    player,
    video.durationInFrames > 0 ? video.composition : null,
    video.durationInFrames,
    cancelReplay
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies(video.composition): a new composition must disarm Inspect and Snapshot through the cleanup and announce inspect.ready again, although the body never reads it
  useEffect(() => {
    if (player.current === null || video.durationInFrames <= 0) {
      return;
    }
    post({ type: "inspect.ready" });
    return () => {
      armInspect(false, spot.current);
      armSnapshot(false, frame.current);
    };
  }, [player, video.composition, video.durationInFrames]);

  useEffect(
    () =>
      onCommand((command) => {
        if (
          studioCommand(command) ||
          inspectOrSnapshot(command, player, spot.current, frame.current) ||
          playbackCommand(command, player, replaying) ||
          targetCommand(command)
        ) {
          return;
        }

        if (command.type === "seek") {
          cancelReplay();
          player.current?.pause();
          player.current?.seekTo(
            Math.max(
              0,
              Math.min(playing.current.durationInFrames - 1, command.frame)
            )
          );
        }
      }),
    [cancelReplay, player]
  );
}

function studioCommand(command: PreviewCommand): boolean {
  if (command.type === "inspect.clear") {
    dismissSelection(false);
    return true;
  }
  if (command.type === "studio.highlight") {
    highlightManaged(command.objectId, command.video, command.generation);
    return true;
  }
  if (command.type === "studio.hover") {
    hoverManaged(command.objectId);
    return true;
  }
  if (command.type === "studio.hide") {
    hide(command.token, command.selectors);
    return true;
  }
  if (command.type === "studio.unhide") {
    reveal(command.token);
    return true;
  }
  return (
    command.type === "studio.draft" ||
    command.type === "studio.batch" ||
    command.type === "studio.request"
  );
}

function targetCommand(command: PreviewCommand): boolean {
  if (command.type === "highlight") {
    highlightTarget(command.targetId, command.open);
    return true;
  }

  if (command.type === "tune.set" || command.type === "tune.reset") {
    const result = tune(command);
    post({
      error: result.error,
      ok: result.ok,
      requestId: command.requestId,
      type: "tune.result",
    });
    return true;
  }

  return false;
}

function playbackCommand(
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
      armSnapshot(false, frame);
    }
    post({
      paused: player.current !== null && !player.current.isPlaying(),
      status: armInspect(command.armed, spot),
      type: "inspect",
    });
    return true;
  }

  if (command.type === "snapshot") {
    if (command.armed) {
      armInspect(false, spot);
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
// opened this runtime for, and a miss is a fact worth reporting; `preferred` is the
// basename of the opened folder, a guess from #226 whose miss is unremarkable.
function askedId(): string | null {
  return nativeSurface()?.composition ?? null;
}

function preferredId(): string | null {
  return nativeSurface()?.preferred ?? null;
}
