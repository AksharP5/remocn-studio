import {
  createContext,
  type CSSProperties,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { z } from "zod";

type Value = string | number | boolean | readonly number[];
const Bezier = z.tuple([
  z.number().min(0).max(1),
  z.number().finite(),
  z.number().min(0).max(1),
  z.number().finite(),
]);
interface ObjectDocument {
  readonly definitions: readonly {
    readonly id: string;
    readonly version: number;
    readonly fields: readonly {
      readonly id: string;
      readonly type: string;
      readonly unit?: string;
    }[];
  }[];
  readonly objects: readonly {
    readonly id: string;
    readonly definition: string;
    readonly label: string;
    readonly parentId: string | null;
    readonly values: Readonly<Record<string, Value | undefined>>;
  }[];
  readonly operations: readonly { readonly id: string }[];
  readonly version: number;
  readonly video: string;
}

interface ContextValue {
  readonly document: ObjectDocument;
  readonly drafts: Readonly<Record<string, Readonly<Record<string, Value>>>>;
  readonly generation: string;
}

const Command = z.discriminatedUnion("type", [
  z.object({
    generation: z.string(),
    objectId: z.string(),
    source: z.literal("remocn-studio"),
    type: z.literal("studio.batch"),
    values: z.record(
      z.string(),
      z.union([z.string(), z.number().finite(), z.boolean(), Bezier])
    ),
  }),
  z.object({
    source: z.literal("remocn-studio"),
    type: z.literal("studio.request"),
  }),
  z.object({
    field: z.string(),
    generation: z.string(),
    objectId: z.string(),
    source: z.literal("remocn-studio"),
    type: z.literal("studio.draft"),
    value: z.union([z.string(), z.number().finite(), z.boolean(), Bezier]),
  }),
]);

function acceptsDraft(
  document: ObjectDocument,
  command: z.infer<typeof Command> & { type: "studio.draft" }
): boolean {
  const object = document.objects.find((item) => item.id === command.objectId);
  const definition = document.definitions.find(
    (item) => item.id === object?.definition
  );
  const field = definition?.fields.find((item) => item.id === command.field);
  if (!(object && field && Object.hasOwn(object.values, field.id))) {
    return false;
  }
  if (field.type === "easing") {
    return Bezier.safeParse(command.value).success;
  }
  if (field.type === "number") {
    return typeof command.value === "number";
  }
  if (field.type === "boolean") {
    return typeof command.value === "boolean";
  }
  return typeof command.value === "string";
}

const Objects = createContext<ContextValue | null>(null);

export function StudioObjects({
  document,
  children,
}: {
  document: ObjectDocument;
  children: ReactNode;
}) {
  const { generation } = useMemo(
    () => ({ document, generation: crypto.randomUUID() }),
    [document]
  );
  const [drafts, setDrafts] = useState<ContextValue["drafts"]>({});

  useEffect(() => {
    setDrafts({});
    if (window.parent === window) {
      return;
    }
    const ready = () =>
      window.parent.postMessage(
        {
          generation,
          lastOperationId: document.operations.at(-1)?.id ?? null,
          source: "remocn-preview",
          type: "studio.ready",
          video: document.video,
        },
        "*"
      );
    const receive = (event: MessageEvent) => {
      if (event.source !== window.parent) {
        return;
      }
      const parsed = Command.safeParse(event.data);
      if (!parsed.success) {
        return;
      }
      const command = parsed.data;
      if (command.type === "studio.request") {
        ready();
        return;
      }
      if (command.type === "studio.batch") {
        const entries = Object.entries(command.values);
        if (
          command.generation !== generation ||
          entries.length === 0 ||
          !entries.every(([field, value]) =>
            acceptsDraft(document, {
              source: "remocn-studio",
              type: "studio.draft",
              generation,
              objectId: command.objectId,
              field,
              value,
            })
          )
        )
          return;
        setDrafts((previous) => ({
          ...previous,
          [command.objectId]: {
            ...previous[command.objectId],
            ...command.values,
          },
        }));
        return;
      }
      if (
        command.generation !== generation ||
        !acceptsDraft(document, command)
      ) {
        return;
      }
      setDrafts((previous) => ({
        ...previous,
        [command.objectId]: {
          ...previous[command.objectId],
          [command.field]: command.value,
        },
      }));
    };
    window.addEventListener("message", receive);
    ready();
    return () => window.removeEventListener("message", receive);
  }, [document, generation]);

  const value = useMemo(
    () => ({ document, drafts, generation }),
    [document, generation, drafts]
  );
  if (document.version !== 1) {
    throw new Error("This video needs a compatible Studio object runtime.");
  }
  return <Objects.Provider value={value}>{children}</Objects.Provider>;
}

export function useStudioObject(id: string, occurrence = "main") {
  const context = useContext(Objects);
  if (context === null) {
    throw new Error("An editable object must be inside StudioObjects.");
  }
  const matches = context.document.objects.filter((item) => item.id === id);
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one editable object named ${id}.`);
  }
  const [object] = matches;
  const values = { ...object.values, ...context.drafts[id] };
  return {
    bind: {
      "data-design-id": id,
      "data-studio-generation": context.generation,
      "data-studio-label": object.label,
      "data-studio-object": id,
      "data-studio-occurrence": occurrence,
      "data-studio-video": context.document.video,
    },
    geometry: (fields: {
      x: string;
      y: string;
      width: string;
      height: string;
      rotation?: string;
    }) => {
      const definition = context.document.definitions.find(
        (item) => item.id === object.definition
      );
      const keys = ["x", "y", "width", "height", "rotation"] as const;
      const bindings = { ...fields, rotation: fields.rotation ?? null };
      const ids = Object.values(bindings).filter((field) => field !== null);
      if (new Set(ids).size !== ids.length) {
        throw new Error(
          `${object.label}: geometry fields must be independent.`
        );
      }
      const geometry = { x: 0, y: 0, width: 0, height: 0, rotation: 0 };
      for (const key of keys) {
        const id = bindings[key];
        if (id === null) continue;
        const field = definition?.fields.find((item) => item.id === id);
        const value = values[id];
        if (
          field?.type !== "number" ||
          typeof value !== "number" ||
          !Number.isFinite(value) ||
          (field.unit !== undefined &&
            field.unit !== (key === "rotation" ? "deg" : "px"))
        ) {
          throw new Error(
            `${object.label}: ${id} must be a numeric geometry field in ${key === "rotation" ? "degrees" : "pixels"}.`
          );
        }
        if ((key === "width" || key === "height") && value < 1) {
          throw new Error(`${object.label}: ${id} must be at least one pixel.`);
        }
        geometry[key] = value;
      }
      const style: CSSProperties = {
        position: "absolute",
        left: geometry.x,
        top: geometry.y,
        width: geometry.width,
        height: geometry.height,
        rotate: `${geometry.rotation}deg`,
        transformOrigin: "center",
        boxSizing: "border-box",
        margin: 0,
        touchAction: "none",
      };
      return {
        bind: {
          "data-studio-geometry": JSON.stringify(bindings),
          "data-studio-geometry-values": JSON.stringify(geometry),
        },
        style,
      };
    },
    bindText: (field: string) => {
      const definition = context.document.definitions.find(
        (item) => item.id === object.definition
      );
      if (
        definition?.fields.find((item) => item.id === field)?.type !== "text" ||
        typeof values[field] !== "string"
      ) {
        throw new Error(
          `${object.label}: ${field} must be a declared text field.`
        );
      }
      return { "data-studio-text-field": field };
    },
    easing: (field: string): [number, number, number, number] => {
      const parsed = Bezier.safeParse(values[field]);
      if (!parsed.success) {
        throw new Error(
          `${object.label}: ${field} must be a valid cubic Bezier curve.`
        );
      }
      return parsed.data;
    },
    flag: (field: string): boolean => {
      const value = values[field];
      if (typeof value !== "boolean") {
        throw new Error(`${object.label}: ${field} must be a switch value.`);
      }
      return value;
    },
    number: (field: string): number => {
      const value = values[field];
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`${object.label}: ${field} must be a finite number.`);
      }
      return value;
    },
    text: (field: string): string => {
      const value = values[field];
      if (typeof value !== "string") {
        throw new Error(`${object.label}: ${field} must be text.`);
      }
      return value;
    },
  };
}
