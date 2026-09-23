import {
  Internals as ProjectInternals,
  cancelRender as projectCancelRender,
  continueRender as projectContinueRender,
  delayRender as projectDelayRender,
  staticFile as projectStaticFile,
} from "__remocn_project_remotion";
import insertNativeStyle from "./native-style";

declare const __REMOCN_NATIVE_ASSETS__: string;

// biome-ignore lint/performance/noBarrelFile: webpack aliases remotion$ to this facade, so it must re-export every binding of the project's own Remotion version, whatever that version exports
export * from "__remocn_project_remotion";

let live = true;
const handles = new Set<number>();
export const delayScope = {
  remotion_attempt: 1,
  remotion_delayRenderHandles: [] as number[],
  remotion_delayRenderTimeouts: {} as Record<
    string,
    { label: string | null; timeout: number; startTime: number }
  >,
  remotion_puppeteerTimeout: 30_000,
  remotion_renderReady: false,
};

export function delayRender(
  ...args: Parameters<typeof projectDelayRender>
): number {
  if (!live) {
    return Math.random();
  }
  const handle = projectDelayRender(...args);
  handles.add(handle);
  return handle;
}

export function continueRender(handle: number): void {
  if (!live) {
    return;
  }
  handles.delete(handle);
  projectContinueRender(handle);
}

export function cancelRender(
  ...args: Parameters<typeof projectCancelRender>
): void {
  if (live) {
    projectCancelRender(...args);
  }
}

export function pendingRenders(): number {
  return handles.size + delayScope.remotion_delayRenderHandles.length;
}

export function disposeNativeRemotion(): void {
  live = false;
  for (const handle of handles) {
    projectContinueRender(handle);
  }
  handles.clear();
  for (const pending of Object.values(
    delayScope.remotion_delayRenderTimeouts
  )) {
    clearTimeout(pending.timeout);
  }
  delayScope.remotion_delayRenderTimeouts = {};
  delayScope.remotion_delayRenderHandles = [];
}

export function staticFile(file: string): string {
  return `${__REMOCN_NATIVE_ASSETS__}${projectStaticFile(file)}`;
}

export const Internals = {
  ...ProjectInternals,
  CSSUtils: {
    ...ProjectInternals.CSSUtils,
    injectCSS: (css: string) => {
      const style = document.createElement("style");
      style.textContent = css;
      insertNativeStyle(style);
      return () => style.remove();
    },
  },
};
