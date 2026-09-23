import { useEffect, useState } from "react";
import { onCommand } from "./bridge";

export const PLAYBACK_RATES = [0.25, 0.5, 1, 2] as const;

export function usePlaybackRate(): number {
  const [rate, setRate] = useState(1);
  useEffect(
    () =>
      onCommand((command) => {
        if (
          command.type === "transport.rate" &&
          (PLAYBACK_RATES as readonly number[]).includes(command.rate)
        ) {
          setRate(command.rate);
        }
      }),
    []
  );
  return rate;
}
