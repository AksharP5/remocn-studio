"use client";

import { Effect, Fiber } from "effect";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CodeHighlighterPlugin } from "streamdown";
import {
  loadCodeHighlighter,
  loadedMarkdownRenderer,
  loadMarkdownRenderer,
  type MarkdownRenderer,
} from "@/lib/studio/highlighter";

export interface CodeHighlighting {
  plugin: CodeHighlighterPlugin | null;
  request: () => void;
}

const FENCE = /^\s{0,3}(```|~~~)/m;

export const NO_HIGHLIGHTING: CodeHighlighting = {
  plugin: null,
  request: () => undefined,
};

export function useCodeHighlighter(): CodeHighlighting {
  const [plugin, setPlugin] = useState<CodeHighlighterPlugin | null>(null);
  const [isWanted, setIsWanted] = useState(false);
  const request = useCallback(() => setIsWanted(true), []);

  useEffect(() => {
    if (!isWanted) {
      return;
    }

    const fiber = Effect.runFork(
      loadCodeHighlighter.pipe(
        Effect.tap((loaded) => Effect.sync(() => setPlugin(loaded))),
        Effect.ignore
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [isWanted]);

  return useMemo(() => ({ plugin, request }), [plugin, request]);
}

export function useMarkdownRenderer(): MarkdownRenderer | null {
  const [renderer, setRenderer] = useState(loadedMarkdownRenderer);

  useEffect(() => {
    if (renderer !== null) {
      return;
    }

    const fiber = Effect.runFork(
      loadMarkdownRenderer.pipe(
        Effect.tap((loaded) => Effect.sync(() => setRenderer(loaded))),
        Effect.ignore
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [renderer]);

  return renderer;
}

export function useHighlighterFor(
  { plugin, request }: CodeHighlighting,
  text: string
): CodeHighlighterPlugin | null {
  const hasCode = FENCE.test(text);

  useEffect(() => {
    if (hasCode) {
      request();
    }
  }, [hasCode, request]);

  return plugin;
}
