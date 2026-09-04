// Aborting a signal that was handed to a spawned child reaches Node's
// `abortChildProcess`, which kills the child and then emits `error` on it —
// and an emitter with no `error` listener throws. The Codex SDK attaches its
// listener with `once`, so once a child has already raised one error the next
// abort has nowhere to go. Measured against bun 1.3.2: that happens only while
// the child is alive with its listener spent — every exit path is safe — and
// Bun raises it as an *uncaught exception from inside `abort()` itself*, not
// as a throw to the caller, so a try/catch around the call sees nothing: the
// stack lands in sidecar.log on every cancel, and on a release with crash
// consent Sentry's uncaught-exception handler takes it as fatal. The
// interception therefore lives on the process,
// for the duration of the call and one turn of the event loop after it, and
// takes exactly the one error the abort can raise; anything else is put back
// on the loop as the uncaught exception it was.
const ABORTED = "AbortError";

export function abortQuietly(controller: AbortController): void {
  const swallow = (error: unknown) => {
    if (isAbortError(error)) {
      return;
    }
    process.off("uncaughtException", swallow);
    queueMicrotask(() => {
      throw error;
    });
  };

  process.on("uncaughtException", swallow);

  try {
    controller.abort();
  } catch (error) {
    if (!isAbortError(error)) {
      throw error;
    }
  } finally {
    setTimeout(() => process.off("uncaughtException", swallow), 0).unref();
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === ABORTED;
}
