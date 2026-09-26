import { Cause, Effect, Exit } from "effect";
import { SIDECAR_PROTOCOL } from "@/shared/ipc";
import { layerProcess, SidecarChannel } from "./channel";
import { startCrashReporting } from "./crash";
import { handlers } from "./handlers";
import { ProjectStore } from "./history/projects";
import { openStores } from "./history/sqlite";
import { HistoryStore } from "./history/store";
import { VideoStore } from "./history/videos";
import { runHost } from "./host";
import { untilOrphaned, untilSignalled } from "./lifecycle";
import { CONFIG_HOST_FLAG } from "./preview/config";
import { runConfigHost } from "./preview/config-host";
import { runPreviewHost } from "./preview/host";
import { previewRoot, prunePreviewOutputs } from "./preview/outputs";
import { PREVIEW_HOST_FLAG } from "./preview/supervisor";
import { runToolsHost } from "./tools/host";
import { TOOLS_HOST_FLAG } from "./tools/protocol";

const sidecar = Effect.gen(function* () {
  const channel = yield* SidecarChannel;

  yield* channel.log(`listening on stdio, protocol ${SIDECAR_PROTOCOL}`);

  const stores = yield* openStores(channel.log);

  yield* Effect.forkScoped(
    stores.projects.list.pipe(
      Effect.flatMap((projects) =>
        prunePreviewOutputs({
          known: projects.map((project) => project.path),
          now: Date.now(),
          root: previewRoot(),
        })
      ),
      Effect.flatMap((removed) =>
        removed.length === 0
          ? Effect.void
          : channel.log(
              `pruned ${removed.length} stale preview output(s): ${removed.join(", ")}`
            )
      ),
      Effect.ignore
    )
  );

  const reason = yield* Effect.raceAll([
    runHost(handlers).pipe(Effect.as("the host closed stdin")),
    untilOrphaned,
    untilSignalled,
  ]).pipe(
    Effect.provideService(HistoryStore, stores.history),
    Effect.provideService(ProjectStore, stores.projects),
    Effect.provideService(VideoStore, stores.videos)
  );

  yield* channel.log(reason);
}).pipe(Effect.scoped, Effect.provide(layerProcess));

const chosen = (() => {
  if (process.argv.includes(PREVIEW_HOST_FLAG)) {
    return runPreviewHost;
  }
  if (process.argv.includes(TOOLS_HOST_FLAG)) {
    return runToolsHost;
  }
  if (process.argv.includes(CONFIG_HOST_FLAG)) {
    return runConfigHost;
  }
  return sidecar;
})();

// Ahead of all three, because all three are this same bundle: the preview
// host's webpack compile and the tool host's gateway crash the same way the
// sidecar does, and one call covers them because they share an environment.
const main = Effect.andThen(startCrashReporting, chosen);

const exit = await Effect.runPromiseExit(main);

if (Exit.isFailure(exit)) {
  process.stderr.write(`${Cause.pretty(exit.cause)}\n`);
}

process.exit(Exit.isSuccess(exit) ? 0 : 1);
