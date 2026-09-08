import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SIDECAR_PROTOCOL } from "@/shared/ipc";

const RUST = fileURLToPath(new URL("../src-tauri/src/ipc.rs", import.meta.url));
const PROTOCOL = /pub const PROTOCOL: u32 = (\d+);/;

// The guard exists to catch a core and a sidecar that disagree. Four bumps
// landed on the TypeScript side without the Rust mirror following, so every
// launch logged a mismatch and a real one would have looked the same. The
// Rust side cannot see this constant, so the pair is pinned here.
describe("the IPC protocol", () => {
  it("is the same number on both sides of the wire", () => {
    const source = readFileSync(RUST, "utf8");
    const found = PROTOCOL.exec(source);

    expect(found).not.toBeNull();
    expect(Number(found?.[1])).toBe(SIDECAR_PROTOCOL);
  });
});
