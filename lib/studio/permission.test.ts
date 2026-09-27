import { describe, expect, it } from "bun:test";
import {
  batchChoices,
  batchTitle,
  gatheredAsks,
} from "@/lib/studio/permission";
import type { PendingPermission } from "@/lib/studio/turns";
import type { PermissionReason } from "@/shared/ipc";

function ask(id: string, reason: PermissionReason): PendingPermission {
  return { askedAt: 0, id, input: {}, name: "Tool", reason };
}

describe("gatheredAsks", () => {
  it("is empty when nothing is outstanding", () => {
    expect(gatheredAsks([])).toEqual([]);
  });

  it("gathers every ask with the oldest ask's reason, in order", () => {
    const pending = [
      ask("a", "outward"),
      ask("b", "bash"),
      ask("c", "outward"),
      ask("d", "outward"),
    ];

    expect(gatheredAsks(pending).map((item) => item.id)).toEqual([
      "a",
      "c",
      "d",
    ]);
  });

  it("never gathers anything onto a plan", () => {
    const pending = [ask("p", "plan"), ask("q", "plan"), ask("b", "bash")];

    expect(gatheredAsks(pending).map((item) => item.id)).toEqual(["p"]);
  });
});

describe("batch wording", () => {
  it("counts the asks in the title", () => {
    expect(batchTitle("outside", 4)).toBe(
      "Approve these 4 paths outside the project?"
    );
  });

  it("never offers to remember a paid request", () => {
    expect(
      batchChoices("outward", 3, 3).map((choice) => choice.action)
    ).toEqual(["allow", "deny", "cancel"]);
  });

  it("counts what the approve choices cover and disables them with nothing checked", () => {
    expect(batchChoices("bash", 1, 3).map((choice) => choice.label)).toEqual([
      "Approve 1 of 3",
      "Always allow 1 of 3 until quit",
      "Decline all",
      "Cancel turn",
    ]);

    expect(
      batchChoices("bash", 0, 3)
        .filter((choice) => choice.disabled === true)
        .map((choice) => choice.id)
    ).toEqual(["allow", "always"]);
  });
});
