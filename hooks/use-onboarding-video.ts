"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useOnboardingVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const play = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.play().catch(() => undefined);
    }
  }, []);
  useEffect(() => {
    const video = videoRef.current;
    if (reducedMotion) {
      video?.pause();
    } else {
      play();
    }
    return () => {
      video?.pause();
    };
  }, [play, reducedMotion]);
  const onError = useCallback(() => setFailed(true), []);
  const retry = useCallback(() => {
    setFailed(false);
    videoRef.current?.load();
    if (!reducedMotion) {
      play();
    }
  }, [play, reducedMotion]);
  return { failed, onError, retry, videoRef };
}
