import { describe, expect, it } from "bun:test";
import type { Connection } from "@/shared/integrations";
import {
  type ConnectionCalls,
  listConnections,
  NONE_CONNECTED,
} from "@/sidecar/integrations/tools";

function connection(shape: Partial<Connection> = {}): Connection {
  return {
    account: "studio@remocn.dev",
    capabilities: ["audio"],
    detail: null,
    disabled: false,
    id: "cn_1",
    name: "My ElevenLabs",
    provider: "elevenlabs",
    state: "connected",
    ...shape,
  };
}

function calls(usable: readonly Connection[]): ConnectionCalls {
  return { usable: () => Promise.resolve(usable) };
}

describe("what a turn is told about connections", () => {
  it("names each service, its connection and what it can do", async () => {
    const said = await listConnections(calls([connection()]));

    expect(said).toContain("elevenlabs");
    expect(said).toContain("My ElevenLabs");
    expect(said).toContain("studio@remocn.dev");
    expect(said).toContain("audio");
  });

  it("tells the two connections of one service apart", async () => {
    const said = await listConnections(
      calls([
        connection({ account: "work@remocn.dev", id: "cn_1", name: "Work" }),
        connection({ account: "home@remocn.dev", id: "cn_2", name: "Home" }),
      ])
    );

    expect(said).toContain("Work");
    expect(said).toContain("Home");
    expect(said).toContain("work@remocn.dev");
    expect(said).toContain("home@remocn.dev");
  });

  it("says nothing is connected as a sentence, not an error", async () => {
    const said = await listConnections(calls([]));

    expect(said).toBe(NONE_CONNECTED);
    expect(said).toContain("Settings");
  });

  it("carries no credential in what it says", async () => {
    const said = await listConnections(calls([connection()]));

    expect(said).not.toContain("sk-");
    expect(said.toLowerCase()).not.toContain("token");
    expect(said.toLowerCase()).not.toContain("key");
  });

  it("copes with a connection whose account is not known", async () => {
    const said = await listConnections(calls([connection({ account: null })]));

    expect(said).toContain("My ElevenLabs");
    expect(said).not.toContain("(null)");
  });
});
