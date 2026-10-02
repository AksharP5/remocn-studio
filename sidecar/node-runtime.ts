import { existsSync } from "node:fs";
import path from "node:path";
import { DATA_DIR_ENV } from "@/shared/ipc";

export function managedNodeDir(): string | null {
  const data = process.env[DATA_DIR_ENV];
  return data === undefined ? null : path.join(data, "node");
}

export function activateManagedNode(): void {
  const dir = managedNodeDir();
  if (process.platform !== "linux" || dir === null) {
    return;
  }

  const bin = path.join(dir, "bin");
  if (!existsSync(path.join(bin, "node"))) {
    return;
  }

  const dirs = (process.env.PATH ?? "").split(path.delimiter);
  process.env.PATH = [bin, ...dirs.filter((entry) => entry !== bin)].join(
    path.delimiter
  );
}
