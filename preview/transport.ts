import { nativeSurface } from "./surface";
import type { PlayerRef } from "@remotion/player";
import { type RefObject, useEffect } from "react";
import { onCommand, post } from "./bridge";

const INTERACTIVE =
  "input, textarea, select, button, a, [contenteditable]:not([contenteditable='false']), [role='slider'], [role='textbox'], [role='button']";

export function usePlayerTransport(
  player: RefObject<PlayerRef | null>,
  composition: string | null,
  durationInFrames: number,
  cancelReplay: () => void
) {
  useEffect(() => {
    const ref = player.current;
    if (ref === null || composition === null) {
      return;
    }

    let buffering = false;
    let error: string | null = null;
    let muted = ref.isMuted();
    let volume = ref.getVolume();
    const announce = () => {
      post({
        buffering,
        compositionId: composition,
        error,
        muted,
        type: "transport.state",
        volume,
      });
    };
    const toggle = () => {
      cancelReplay();
      error = null;
      try {
        if (ref.isPlaying()) {
          ref.pause();
        } else {
          ref.play();
        }
      } catch {
        error = "Playback could not start. Press Play to try again.";
      }
      announce();
    };
    const step = (direction: -1 | 1) => {
      cancelReplay();
      ref.pause();
      ref.seekTo(
        Math.max(
          0,
          Math.min(durationInFrames - 1, ref.getCurrentFrame() + direction)
        )
      );
    };
    const stopCommands = onCommand((command) => {
      if (command.type === "transport.request") {
        muted = ref.isMuted();
        volume = ref.getVolume();
        announce();
        post({
          frame: ref.getCurrentFrame(),
          playing: ref.isPlaying(),
          type: "playhead",
        });
      } else if (command.type === "transport.toggle") {
        toggle();
      } else if (command.type === "transport.step") {
        if (command.direction === -1 || command.direction === 1) {
          step(command.direction);
        }
      } else if (command.type === "transport.audio") {
        if (
          !Number.isFinite(command.volume) ||
          command.volume < 0 ||
          command.volume > 1 ||
          typeof command.muted !== "boolean"
        ) {
          return;
        }
        ref.setVolume(command.volume);
        if (command.muted) {
          ref.mute();
        } else {
          ref.unmute();
        }
      }
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        (event.target instanceof Element && event.target.closest(INTERACTIVE))
      ) {
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        if (!event.repeat) {
          toggle();
        }
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        step(event.key === "ArrowLeft" ? -1 : 1);
      }
    };
    const onWaiting = () => {
      buffering = true;
      announce();
    };
    const onResume = () => {
      buffering = false;
      announce();
    };
    const onError = () => {
      error = "The preview could not play. Check the video and try again.";
      announce();
    };
    const onVolume = ({ detail }: { detail: { volume: number } }) => {
      volume = detail.volume;
      announce();
    };
    const onMute = ({ detail }: { detail: { isMuted: boolean } }) => {
      muted = detail.isMuted;
      announce();
    };

    ref.addEventListener("volumechange", onVolume);
    ref.addEventListener("mutechange", onMute);
    ref.addEventListener("waiting", onWaiting);
    ref.addEventListener("resume", onResume);
    ref.addEventListener("error", onError);
    if (!nativeSurface()) window.addEventListener("keydown", onKeyDown);
    announce();

    return () => {
      stopCommands();
      ref.removeEventListener("volumechange", onVolume);
      ref.removeEventListener("mutechange", onMute);
      ref.removeEventListener("waiting", onWaiting);
      ref.removeEventListener("resume", onResume);
      ref.removeEventListener("error", onError);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [cancelReplay, composition, durationInFrames, player]);
}
