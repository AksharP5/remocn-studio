// @vitest-environment node
import { Exit } from "effect";
import { describe, expect, it } from "vitest";
import { decodeHostCommand, decodeHostReply } from "./protocol";

describe("preview design protocol", () => {
  it("decodes a batch design command", () => {
    const decoded = decodeHostCommand(
      JSON.stringify({
        composition: "Main",
        frames: [30, 90],
        id: "request-1",
        motion: [],
        type: "design",
        video: null,
      })
    );

    expect(Exit.isSuccess(decoded)).toBe(true);
  });

  it("decodes each motion assertion kind on the design command", () => {
    const decoded = decodeHostCommand(
      JSON.stringify({
        composition: "Main",
        frames: [30, 90],
        id: "request-1",
        motion: [
          {
            from: 30,
            kind: "changes_between",
            selector: "[data-design-id='orb']",
            to: 90,
          },
          {
            frame: 60,
            kind: "visible_at",
            selector: "[data-design-id='headline']",
          },
          { kind: "stays_in_frame", selector: ".ticker" },
        ],
        type: "design",
        video: null,
      })
    );

    expect(Exit.isSuccess(decoded)).toBe(true);
  });

  it("decodes a design command carrying the whole-video scene map", () => {
    const decoded = decodeHostCommand(
      JSON.stringify({
        composition: "Main",
        frames: [30, 90],
        id: "request-1",
        motion: [],
        type: "design",
        video: {
          camera: "[data-design-id='stage']",
          scenes: [
            { from: 0, name: "open", to: 60 },
            { from: 60, name: "claim", to: 150 },
          ],
        },
      })
    );

    expect(Exit.isSuccess(decoded)).toBe(true);
  });

  it("refuses a scene the map did not name", () => {
    const decoded = decodeHostCommand(
      JSON.stringify({
        composition: "Main",
        frames: [30, 90],
        id: "request-1",
        motion: [],
        type: "design",
        video: { camera: null, scenes: [{ from: 0, to: 60 }] },
      })
    );

    expect(Exit.isSuccess(decoded)).toBe(false);
  });

  it("refuses a motion assertion the union does not know", () => {
    const decoded = decodeHostCommand(
      JSON.stringify({
        composition: "Main",
        frames: [30, 90],
        id: "request-1",
        motion: [{ kind: "keeps_moving", selector: ".orb" }],
        type: "design",
      })
    );

    expect(Exit.isSuccess(decoded)).toBe(false);
  });

  it("decodes an agent-readable design result", () => {
    const decoded = decodeHostReply(
      JSON.stringify({
        id: "request-1",
        result: {
          composition: "Main",
          findings: [],
          frames: [30, 90],
          height: 1080,
          snapshots: [
            { frame: 30, path: "/tmp/frame-30.png" },
            { frame: 90, path: "/tmp/frame-90.png" },
          ],
          summary: { errors: 0, info: 0, warnings: 0 },
          width: 1920,
        },
        type: "design-done",
      })
    );

    expect(Exit.isSuccess(decoded)).toBe(true);
  });

  it("decodes source capture commands and replies", () => {
    expect(
      Exit.isSuccess(
        decodeHostCommand(
          JSON.stringify({
            id: "request-2",
            output: "/tmp/source.png",
            type: "source",
            url: "https://example.com/brand",
          })
        )
      )
    ).toBe(true);
    expect(
      Exit.isSuccess(
        decodeHostReply(
          JSON.stringify({
            id: "request-2",
            path: "/tmp/source.png",
            type: "source-done",
          })
        )
      )
    ).toBe(true);
  });
});
