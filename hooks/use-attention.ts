"use client";

import { Effect } from "effect";
import { type RefObject, useEffect, useRef } from "react";
import {
  type AttentionReading,
  attentionEvents,
  type NotifyEvent,
} from "@/lib/studio/attention";
import { post } from "@/lib/studio/notifications";

export interface AttentionSettings {
  readonly exportVideoName: string | null;
  readonly isEnabled: boolean;
  readonly isEventEnabled: (event: NotifyEvent) => boolean;
  readonly isFocused: RefObject<boolean>;
  readonly reading: AttentionReading;
  readonly videoNameOf: (historyId: string) => string | null;
}

export function useAttention({
  exportVideoName,
  isEnabled,
  isEventEnabled,
  isFocused,
  reading,
  videoNameOf,
}: AttentionSettings): void {
  const before = useRef(reading);
  const names = useRef({ exportVideoName, videoNameOf });
  names.current = { exportVideoName, videoNameOf };
  const enabled = useRef({ isEnabled, isEventEnabled });
  enabled.current = { isEnabled, isEventEnabled };

  useEffect(() => {
    const previous = before.current;
    before.current = reading;

    const events = attentionEvents(previous, reading, {
      exportVideoName: names.current.exportVideoName,
      isEnabled: enabled.current.isEnabled,
      isEventEnabled: enabled.current.isEventEnabled,
      isFocused: isFocused.current,
      videoNameOf: names.current.videoNameOf,
    });

    for (const event of events) {
      Effect.runFork(
        post(event.title, event.body).pipe(
          Effect.catch((failure) =>
            Effect.logWarning(`notification dropped: ${failure.message}`)
          )
        )
      );
    }
  }, [isFocused, reading]);
}
