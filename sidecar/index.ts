import { Cause, Effect, Exit } from "effect";
import { startCrashReporting } from "./crash";
import { CONFIG_HOST_FLAG, PREVIEW_HOST_FLAG, TOOLS_HOST_FLAG } from "./flags";
import { activateManagedNode } from "./node-runtime";

const chosen = Effect.flatten(
  Effect.promise(async () => {
    if (process.argv.includes(PREVIEW_HOST_FLAG)) {
      return (await import("./preview/host")).runPreviewHost;
    }
    if (process.argv.includes(TOOLS_HOST_FLAG)) {
      return (await import("./tools/host")).runToolsHost;
    }
    if (process.argv.includes(CONFIG_HOST_FLAG)) {
      return (await import("./preview/config-host")).runConfigHost;
    }
    return (await import("./serve")).runSidecar;
  })
);

// Ahead of all three, because all three are this same bundle: the preview
// host's webpack compile and the tool host's gateway crash the same way the
// sidecar does, and one call covers them because they share an environment.
const main = Effect.andThen(
  Effect.sync(activateManagedNode),
  Effect.andThen(startCrashReporting, chosen)
);

const exit = await Effect.runPromiseExit(main);

if (Exit.isFailure(exit)) {
  process.stderr.write(`${Cause.pretty(exit.cause)}\n`);
}

process.exit(Exit.isSuccess(exit) ? 0 : 1);
