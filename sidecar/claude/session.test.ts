import { describe, expect, it } from "bun:test";
import type { StdioTransport } from "../tools/gateway";
import { serversOf } from "./session";

const stdio = (server: string): StdioTransport => ({
  args: ["main.js", "--tools-host", server],
  command: "bun",
  env: { REMOCN_STUDIO_TOOLS_TURN: "turn-1" },
});

const ask = () => Promise.resolve({ isError: false, text: "ok" });

describe("serversOf", () => {
  it("serves the studio's tools inside the sidecar, under their own server names", () => {
    const servers = serversOf({
      inProcess: { "remocn-design": ask, "remocn-library": ask },
      tools: {
        "remocn-design": stdio("remocn-design"),
        "remocn-library": stdio("remocn-library"),
      },
    });

    expect(Object.keys(servers).sort()).toEqual([
      "remocn-design",
      "remocn-library",
    ]);
    expect(servers["remocn-design"]?.type).toBe("sdk");
    expect(servers["remocn-library"]?.type).toBe("sdk");
  });

  it("spawns the tool host only for a server with no in-process link", () => {
    const servers = serversOf({
      inProcess: {},
      tools: { "remocn-pipeline": stdio("remocn-pipeline") },
    });

    expect(servers["remocn-pipeline"]).toEqual({
      args: ["main.js", "--tools-host", "remocn-pipeline"],
      command: "bun",
      env: { REMOCN_STUDIO_TOOLS_TURN: "turn-1" },
      type: "stdio",
    });
  });

  it("offers no server the turn was not given", () => {
    const servers = serversOf({
      inProcess: { "remocn-pipeline": ask },
      tools: {},
    });

    expect(servers).toEqual({});
  });
});
