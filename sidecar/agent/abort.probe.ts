// Run under bun by abort.test.ts: the exact shape that killed the sidecar —
// a child alive on our signal whose one `error` listener is already spent.
// With `--plain` it aborts the way the adapter used to and bun prints the
// uncaught AbortError; with the guard stderr stays empty.
import { spawn } from "node:child_process";
import { abortQuietly } from "./abort";

const controller = new AbortController();
const child = spawn("sleep", ["5"], {
  signal: controller.signal,
  stdio: "ignore",
});
child.once("error", () => undefined);
child.emit("error", new Error("the first error spent the listener"));

await new Promise((resolve) => setTimeout(resolve, 50));

if (process.argv.includes("--plain")) {
  controller.abort();
} else {
  abortQuietly(controller);
}

await new Promise((resolve) => setTimeout(resolve, 50));

process.stdout.write(
  JSON.stringify({ aborted: controller.signal.aborted, alive: true })
);
process.exit(0);
