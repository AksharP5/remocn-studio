import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Internals } from "remotion";
import type { TuningValue } from "./bridge";
import {
  controlsChain,
  describeTuning,
  fieldAt,
  type InteractivitySchema,
  isFieldValue,
  nearestInteractive,
  overridePlan,
  type TuningTarget,
} from "./tuning";
import {
  activate,
  type TuningReply,
  type TuningRuntime,
} from "./tuning-runtime";

interface SequenceControls {
  readonly componentName: string;
  readonly currentRuntimeValueDotNotation: Readonly<Record<string, unknown>>;
  readonly overrideId: string;
  readonly schema: InteractivitySchema;
}

interface InteractiveSequence {
  readonly controls: SequenceControls | null;
  readonly refForOutline: { current: Element | null } | null;
}

interface NodePath {
  readonly absolutePath: string;
  readonly effectKeys: readonly string[][];
  readonly nodePath: readonly (number | string)[];
  readonly sequenceKeys: readonly string[];
}

export function InteractivityRuntime({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const { sequences } = useContext(Internals.SequenceManager);
  const setters = useContext(Internals.VisualModeSettersContext);
  const [mappings, setMappings] = useState<Record<string, NodePath>>({});
  const mappingsRef = useRef(mappings);
  const drafts = useRef(new Map<string, Record<string, TuningValue>>());
  // The controls of everything that has been selected, so an edit can find its
  // schema by id even when the component never handed its `controls` to a
  // `<Sequence>` and so registered with none. The overrides themselves ride on
  // the node path we mint, which owes the registry nothing.
  const seen = useRef(new Map<string, SequenceControls>());
  mappingsRef.current = mappings;

  const interactive = sequences as unknown as readonly InteractiveSequence[];

  const controlsFor = useCallback(
    (targetId: string): SequenceControls | null =>
      interactive.find((sequence) => sequence.controls?.overrideId === targetId)
        ?.controls ??
      seen.current.get(targetId) ??
      null,
    [interactive]
  );

  const nodePathFor = useCallback((targetId: string): NodePath => {
    const current = mappingsRef.current[targetId];
    if (current !== undefined) {
      return current;
    }

    const next: NodePath = {
      absolutePath: `remocn.${targetId}`,
      effectKeys: [],
      nodePath: ["remocn", targetId],
      sequenceKeys: [],
    };

    setMappings((previous) => ({ ...previous, [targetId]: next }));
    return next;
  }, []);

  const valuesFor = useCallback(
    (controls: SequenceControls | null): Record<string, unknown> =>
      controls === null
        ? {}
        : {
            ...controls.currentRuntimeValueDotNotation,
            ...drafts.current.get(controls.overrideId),
          },
    []
  );

  const tunable = typeof setters.setPropStatuses === "function";

  const replay = useCallback(
    (targetId: string, nodePath: NodePath) => {
      const plan = overridePlan(drafts.current.get(targetId) ?? {});

      setters.clearDragOverrides(nodePath as never);

      for (const { path, value } of plan.overrides) {
        setters.setDragOverrides(
          nodePath as never,
          path,
          Internals.makeStaticDragOverride(value)
        );
      }

      setters.setPropStatuses(nodePath as never, () => plan.statuses as never);
    },
    [setters]
  );

  const set = useCallback(
    (targetId: string, path: string, value: TuningValue): TuningReply => {
      const controls = controlsFor(targetId);

      if (controls === null) {
        return {
          error: "This component instance is no longer mounted.",
          ok: false,
        };
      }

      if (!tunable) {
        return {
          error:
            "This project's Remotion cannot apply live parameter changes in the preview.",
          ok: false,
        };
      }

      const field = fieldAt(controls.schema, valuesFor(controls), path);
      if (field === null || !isFieldValue(field, value)) {
        return {
          error: "That value is not valid for this control.",
          ok: false,
        };
      }

      drafts.current.set(targetId, {
        ...drafts.current.get(targetId),
        [path]: value,
      });
      replay(targetId, nodePathFor(targetId));

      return { error: null, ok: true };
    },
    [controlsFor, nodePathFor, replay, tunable, valuesFor]
  );

  const reset = useCallback(
    (targetId: string, paths: readonly string[]): TuningReply => {
      if (controlsFor(targetId) === null) {
        return {
          error: "This component instance is no longer mounted.",
          ok: false,
        };
      }

      if (paths.length === 0) {
        drafts.current.delete(targetId);
      } else {
        const next = { ...drafts.current.get(targetId) };
        for (const path of paths) {
          delete next[path];
        }
        if (Object.keys(next).length === 0) {
          drafts.current.delete(targetId);
        } else {
          drafts.current.set(targetId, next);
        }
      }

      replay(targetId, nodePathFor(targetId));
      return { error: null, ok: true };
    },
    [controlsFor, nodePathFor, replay]
  );

  const selectedTargets = useCallback(
    (element: Element): TuningTarget[] => {
      // The chain, innermost first — and it stays a chain rather than being
      // folded into one list. Merging it was wrong: pointing at a word then
      // showed the parameters of every component above it, up to the camera
      // that frames the whole scene. What you clicked is what the pane opens
      // on; the ancestors are offered, not imposed.
      const chain = controlsChain(element) as readonly {
        controls: SequenceControls;
      }[];
      const fallback =
        nearestInteractive(interactive, element)?.controls ?? null;
      const spare = fallback === null ? [] : [{ controls: fallback }];
      const found = chain.length > 0 ? chain : spare;

      return found.flatMap(({ controls }) => {
        seen.current.set(controls.overrideId, controls);
        nodePathFor(controls.overrideId);

        const part = describeTuning({
          componentName: controls.componentName,
          schema: controls.schema,
          targetId: controls.overrideId,
          values: valuesFor(controls),
        });

        return part === null ? [] : [part];
      });
    },
    [interactive, nodePathFor, valuesFor]
  );

  const runtime = useMemo<TuningRuntime>(
    () => ({ reset, set, targetsOf: selectedTargets }),
    [reset, selectedTargets, set]
  );

  useEffect(() => activate(runtime), [runtime]);

  const environment = useMemo(
    () => ({
      isClientSideRendering: false,
      isPlayer: true,
      isReadOnlyStudio: false,
      isRendering: false,
      isStudio: true,
    }),
    []
  );

  return (
    <Internals.OverrideIdsToNodePathsGettersContext.Provider
      value={{ overrideIdToNodePathMappings: mappings }}
    >
      <Internals.RemotionEnvironmentContext.Provider value={environment}>
        {children}
      </Internals.RemotionEnvironmentContext.Provider>
    </Internals.OverrideIdsToNodePathsGettersContext.Provider>
  );
}
