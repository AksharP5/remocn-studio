import { Data, Effect, Queue, Schema, Stream } from "effect";
import type { PreviewCommand } from "./preview";
import type { PreviewSurface } from "./preview-surface";

export class NativePreviewError extends Data.TaggedError("NativePreviewError")<{
  readonly message: string;
}> {}

export type NativePreviewState =
  | { readonly phase: "loading" }
  | { readonly phase: "ready"; readonly stale: string | null }
  | { readonly phase: "failed"; readonly message: string };

const MANIFEST_PATH = "/__remocn/native";
const EVENTS_PATH = "/__remocn/hot";
const MESSAGE_SOURCE = "remocn-preview";
const BEHIND_MS = 8000;

const COMPILE_FAILED = "The canvas preview could not compile. Restart the preview and try again.";
const LOAD_FAILED = "The canvas preview could not load. Restart the preview host and retry.";
const PREPARE_SLOW = "Preparing the canvas took too long. Restart the preview host and retry.";
const INVALID_ADDRESS = "The preview returned an invalid resource address.";
const BUNDLE_FAILED = "The video bundle could not load. Retry the preview.";
const START_FAILED = "The video bundle could not start. Fix the project or restart the preview host.";
const RENDER_FAILED = "The video could not render. Fix the project, then retry the preview.";
const PAINT_SLOW = "The new version of the video took too long to draw.";
const STALE = "The latest change could not be shown. Showing the previous version.";

const Manifest = Schema.Struct({
  version: Schema.Literal(1),
  generation: Schema.Int,
  script: Schema.String,
  assets: Schema.String,
  events: Schema.String,
  preferred: Schema.NullOr(Schema.String),
  project: Schema.String,
});
type Manifest = typeof Manifest.Type;

interface RuntimePosition {
  frame: number;
  playing: boolean;
  muted: boolean;
  volume: number;
}

interface RuntimeSession {
  dispose: () => void;
  position: () => RuntimePosition | null;
  start: (position: RuntimePosition | null) => void;
}

interface NativeRuntime {
  mount: (element: HTMLElement, environment: {
    root: ShadowRoot;
    composition: string | null;
    preferred: string | null;
    viewport: HTMLElement;
    overlays: HTMLElement;
    assets: string;
    url: string;
    project: string;
    position: RuntimePosition | null;
    getStack: (element: Element) => Promise<{ fileName?: string; functionName?: string; lineNumber?: number; columnNumber?: number }[] | null>;
    emit: (message: Record<string, unknown>) => void;
    subscribe: (receive: (command: PreviewCommand) => void) => () => void;
  }) => RuntimeSession;
}

export interface StagedDocument {
  readonly video: string;
  readonly lastOperationId: string | null;
}

export interface NativePreviewOptions {
  stage: HTMLElement;
  url: string;
  viewport: HTMLElement;
  overlays: HTMLElement;
  attach: (surface: PreviewSurface) => () => void;
  accepts: (document: StagedDocument | null) => boolean;
  onState: (state: NativePreviewState) => void;
}

interface Slot {
  readonly generation: number;
  readonly painted: Effect.Effect<void, NativePreviewError>;
  readonly document: () => StagedDocument | null;
  readonly position: () => RuntimePosition | null;
  readonly reveal: (position: RuntimePosition | null, rebuilt: boolean) => void;
  readonly dispose: () => void;
}

interface Session {
  current: Slot | null;
  released: boolean;
  readonly slots: Set<Slot>;
  readonly swap: (slot: Slot) => void;
  readonly release: () => void;
}

const REMOTION_GLOBALS = {
  remotion_audioEnabled: true, remotion_videoEnabled: true,
  remotion_audioLatencyHint: "playback", remotion_envVariables: "{}",
  remotion_isStudio: false, remotion_logLevel: "info",
  remotion_numberOfAudioTags: 0, remotion_previewSampleRate: 48000,
  remotion_sampleRate: 48000, remotion_staticBase: "",
};

const HOST_RESET = ":host{all:initial;display:block;color:#000;font:16px/normal sans-serif;text-align:start;color-scheme:normal}*,*::before,*::after{box-sizing:border-box}";

let owner: Session | null = null;

function ownedGlobal(key: string): boolean {
  return key.startsWith("remotion_") || key.startsWith("remocn_native_") || key === "__remocnNativeBundle";
}

const failure = (message: string) => new NativePreviewError({ message });

export function runNativePreview(options: NativePreviewOptions) {
  return Effect.gen(function* () {
    const base = new URL(options.url);
    const session = yield* Effect.acquireRelease(claim(), (held) => Effect.sync(held.release));

    const rebuilds = Stream.callback<void>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          Queue.offerUnsafe(queue, undefined);
          const events = new EventSource(new URL(EVENTS_PATH, base));
          let opened = false;
          events.addEventListener("native-rebuilt", () => Queue.offerUnsafe(queue, undefined));
          events.addEventListener("open", () => {
            if (opened) Queue.offerUnsafe(queue, undefined);
            opened = true;
          });
          return events;
        }),
        (events) => Effect.sync(() => events.close())
      ), { bufferSize: 1, strategy: "sliding" });

    yield* rebuilds.pipe(
      Stream.switchMap(() => Stream.fromEffect(stage(session, base, options))),
      Stream.runDrain
    );
  }).pipe(Effect.scoped);
}

function stage(session: Session, base: URL, options: NativePreviewOptions) {
  return Effect.gen(function* () {
    const manifest = yield* fetchManifest(base);
    if (session.current !== null && session.current.generation === manifest.generation) return;
    const source = yield* fetchScript(manifest.script);
    const slot = yield* Effect.acquireRelease(
      Effect.try({
        try: () => mountSlot(session, manifest, source, base, options),
        catch: () => failure(START_FAILED),
      }),
      (held) => Effect.sync(() => {
        if (session.current !== held) held.dispose();
      })
    );
    yield* slot.painted.pipe(Effect.timeoutOrElse({
      duration: "30 seconds",
      orElse: () => Effect.fail(failure(PAINT_SLOW)),
    }));
    yield* settled(slot, options);
    yield* Effect.try({
      try: () => session.swap(slot),
      catch: () => failure(START_FAILED),
    });
    options.onState({ phase: "ready", stale: null });
  }).pipe(
    Effect.scoped,
    Effect.catch((error) => Effect.sync(() => {
      if (session.released) return;
      options.onState(session.current === null
        ? { phase: "failed", message: error.message }
        : { phase: "ready", stale: STALE });
    }))
  );
}

function settled(slot: Slot, options: NativePreviewOptions) {
  return Effect.gen(function* () {
    const started = Date.now();
    while (true) {
      const editing = options.viewport.hasAttribute("data-preview-editing");
      const waited = Date.now() - started > BEHIND_MS;
      if (!editing && (waited || options.accepts(slot.document()))) return;
      yield* Effect.sleep("100 millis");
    }
  });
}

function fetchManifest(base: URL) {
  return Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: (signal) => fetch(new URL(MANIFEST_PATH, base), { signal, cache: "no-store" }),
      catch: () => failure(LOAD_FAILED),
    });
    if (!response.ok) return yield* Effect.fail(failure(COMPILE_FAILED));
    const body = yield* Effect.tryPromise({
      try: () => response.json() as Promise<unknown>,
      catch: () => failure(LOAD_FAILED),
    });
    const manifest = yield* Schema.decodeUnknownEffect(Manifest)(body).pipe(
      Effect.mapError(() => failure(LOAD_FAILED))
    );
    for (const href of [manifest.script, manifest.assets, manifest.events]) {
      if (new URL(href).origin !== base.origin) return yield* Effect.fail(failure(INVALID_ADDRESS));
    }
    return manifest;
  }).pipe(Effect.timeoutOrElse({
    duration: "90 seconds",
    orElse: () => Effect.fail(failure(PREPARE_SLOW)),
  }));
}

function fetchScript(url: string) {
  return Effect.tryPromise({
    try: async (signal) => {
      const response = await fetch(url, { signal, cache: "no-store" });
      if (!response.ok) throw new Error(response.statusText);
      return response.text();
    },
    catch: () => failure(BUNDLE_FAILED),
  }).pipe(Effect.timeoutOrElse({
    duration: "30 seconds",
    orElse: () => Effect.fail(failure(BUNDLE_FAILED)),
  }));
}

function claim() {
  return Effect.sync(() => {
    owner?.release();
    const globals = window as unknown as Record<string, unknown>;
    const before = new Map(Object.entries(Object.getOwnPropertyDescriptors(window))
      .filter(([key]) => ownedGlobal(key)));
    Object.assign(globals, REMOTION_GLOBALS);
    const session: Session = {
      current: null,
      released: false,
      slots: new Set(),
      swap: (slot) => {
        const previous = session.current;
        const position = previous?.position() ?? null;
        session.current = slot;
        previous?.dispose();
        slot.reveal(position, previous !== null);
      },
      release: () => {
        if (session.released) return;
        session.released = true;
        session.current = null;
        try {
          for (const slot of [...session.slots]) slot.dispose();
        } finally {
          for (const key of Object.keys(window)) {
            if (ownedGlobal(key) && !before.has(key)) delete globals[key];
          }
          for (const [key, descriptor] of before) Object.defineProperty(window, key, descriptor);
          if (owner === session) owner = null;
        }
      },
    };
    owner = session;
    return session;
  });
}

function evaluate(source: string, url: string, script: HTMLScriptElement): NativeRuntime {
  const globals = window as unknown as { __remocnNativeBundle?: NativeRuntime } & Record<string, unknown>;
  for (const key of Object.keys(window)) {
    if (key.startsWith("remocn_native_")) delete globals[key];
  }
  delete globals.__remocnNativeBundle;
  let failed = false;
  const onError = (event: ErrorEvent) => { failed = true; event.preventDefault(); };
  window.addEventListener("error", onError);
  try {
    script.textContent = source.replace(/sourceMappingURL=([^\s]+)/g, (_match, value: string) => `sourceMappingURL=${new URL(value, url).href}`) + `\n//# sourceURL=${url}\n`;
    document.head.appendChild(script);
  } finally {
    window.removeEventListener("error", onError);
  }
  const runtime = globals.__remocnNativeBundle;
  delete globals.__remocnNativeBundle;
  if (failed || typeof runtime?.mount !== "function") throw new Error("The video bundle did not provide a canvas preview.");
  return runtime;
}

function mountSlot(session: Session, manifest: Manifest, source: string, base: URL, options: NativePreviewOptions): Slot {
  if (session.released) throw new Error("The canvas preview was closed.");

  const host = document.createElement("div");
  host.style.cssText = "position:absolute;inset:0;visibility:hidden;pointer-events:none";
  host.inert = true;
  const root = host.attachShadow({ mode: "open" });
  const element = document.createElement("div");
  element.style.cssText = "width:100%;height:100%;position:relative;isolation:isolate;overflow:hidden";
  const reset = document.createElement("style");
  reset.textContent = HOST_RESET;
  root.replaceChildren(reset, element);
  const overlays = document.createElement("div");
  overlays.style.cssText = "position:absolute;inset:0";
  const script = document.createElement("script");

  const messages = new Set<(message: unknown) => void>();
  const commands = new Set<(command: PreviewCommand) => void>();
  const buffered: Record<string, unknown>[] = [];
  const waiting = new Set<(outcome: Effect.Effect<void, NativePreviewError>) => void>();
  let outcome: Effect.Effect<void, NativePreviewError> | null = null;
  let runtime: RuntimeSession | null = null;
  let disconnect: (() => void) | null = null;
  let revealed = false;
  let live = true;

  const settle = (next: Effect.Effect<void, NativePreviewError>) => {
    if (outcome !== null) return;
    outcome = next;
    for (const resume of waiting) resume(next);
    waiting.clear();
  };
  const deliver = (message: Record<string, unknown>) => {
    for (const receive of [...messages]) receive(message);
  };
  const emit = (message: Record<string, unknown>) => {
    if (!live) return;
    if (message.type === "native.painted") {
      settle(Effect.void);
      return;
    }
    if (message.type === "native.error") {
      settle(Effect.fail(failure(RENDER_FAILED)));
      if (session.current === slot) options.onState({ phase: "failed", message: RENDER_FAILED });
      return;
    }
    const tagged = { ...message, source: MESSAGE_SOURCE };
    if (revealed) deliver(tagged);
    else buffered.push(tagged);
  };
  const surface: PreviewSurface = {
    send: (command) => {
      if (live) for (const receive of [...commands]) receive(command);
    },
    subscribe: (receive) => {
      messages.add(receive);
      return () => { messages.delete(receive); };
    },
    focus: () => options.viewport.focus({ preventScroll: true }),
    dispose: () => {
      live = false;
      messages.clear();
      commands.clear();
    },
  };

  const slot: Slot = {
    generation: manifest.generation,
    painted: Effect.callback<void, NativePreviewError>((resume) => {
      if (outcome !== null) resume(outcome);
      else waiting.add(resume);
      return Effect.sync(() => { waiting.delete(resume); });
    }),
    document: () => {
      const ready = buffered.findLast((message) => message.type === "studio.ready");
      return typeof ready?.video === "string"
        ? { video: ready.video, lastOperationId: typeof ready.lastOperationId === "string" ? ready.lastOperationId : null }
        : null;
    },
    position: () => runtime?.position() ?? null,
    reveal: (position, rebuilt) => {
      host.style.cssText = "position:absolute;inset:0";
      host.inert = false;
      revealed = true;
      disconnect = options.attach(surface);
      if (rebuilt) deliver({ type: "rebuilt", source: MESSAGE_SOURCE });
      for (const message of buffered.splice(0)) deliver(message);
      runtime?.start(position);
    },
    dispose: () => {
      if (!session.slots.delete(slot)) return;
      live = false;
      waiting.clear();
      try {
        disconnect?.();
      } finally {
        try { runtime?.dispose(); }
        finally {
          script.remove();
          script.textContent = "";
          host.remove();
          overlays.remove();
        }
      }
    },
  };

  session.slots.add(slot);
  options.stage.append(host);
  options.overlays.append(overlays);
  try {
    const bundle = evaluate(source, manifest.script, script);
    runtime = bundle.mount(element, {
      root,
      composition: base.searchParams.get("composition"),
      preferred: manifest.preferred,
      viewport: options.viewport,
      overlays,
      assets: manifest.assets,
      url: options.url,
      project: manifest.project,
      position: session.current?.position() ?? null,
      getStack: async (target) => {
        const { getStack } = await import("grab/core");
        return getStack(target);
      },
      emit,
      subscribe: (receive) => {
        commands.add(receive);
        return () => { commands.delete(receive); };
      },
    });
  } catch (error) {
    slot.dispose();
    throw error;
  }
  return slot;
}
