import { describe, expect, it } from "bun:test";
import { Exit, Schema } from "effect";
import {
  Connection,
  ConnectionAttempt,
  ConnectionDraft,
  ConnectionRemoval,
  hasCapability,
  IntegrationProvider,
  isUsable,
} from "@/shared/integrations";

const decodeConnection = Schema.decodeUnknownExit(Connection);
const decodeProvider = Schema.decodeUnknownExit(IntegrationProvider);

const connected = {
  account: "studio@remocn.dev",
  capabilities: ["audio"],
  detail: null,
  disabled: false,
  id: "cn_1",
  name: "My ElevenLabs",
  provider: "elevenlabs",
  state: "connected",
};

describe("a connection crossing the wire", () => {
  it("decodes a connected one whole", () => {
    const exit = decodeConnection(connected);

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.account).toBe("studio@remocn.dev");
      expect(exit.value.state).toBe("connected");
      expect(exit.value.capabilities).toEqual(["audio"]);
    }
  });

  it("carries no secret, whatever the core was asked to send", () => {
    const exit = decodeConnection({
      ...connected,
      apiKey: "sk-live-must-never-arrive",
      secret: "must-never-arrive",
    });

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(Object.keys(exit.value)).not.toContain("secret");
      expect(Object.keys(exit.value)).not.toContain("apiKey");
      expect(JSON.stringify(exit.value)).not.toContain("must-never-arrive");
    }
  });

  it("refuses a state the studio does not know", () => {
    const exit = decodeConnection({ ...connected, state: "probably-fine" });

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("refuses a connection with no name", () => {
    const exit = decodeConnection({ ...connected, name: "" });

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("keeps an account that is not known yet", () => {
    const exit = decodeConnection({ ...connected, account: null });

    expect(Exit.isSuccess(exit)).toBe(true);
  });
});

describe("whether a connection may be used", () => {
  it("is yes only when it is connected and not disabled", () => {
    const exit = decodeConnection(connected);
    if (!Exit.isSuccess(exit)) {
      throw new Error("the fixture should decode");
    }

    expect(isUsable(exit.value)).toBe(true);
    expect(isUsable({ ...exit.value, disabled: true })).toBe(false);
    expect(isUsable({ ...exit.value, state: "checking" })).toBe(false);
    expect(isUsable({ ...exit.value, state: "needs-authorization" })).toBe(
      false
    );
    expect(isUsable({ ...exit.value, state: "unavailable" })).toBe(false);
  });

  it("refuses a capability the connection does not carry", () => {
    const exit = decodeConnection(connected);
    if (!Exit.isSuccess(exit)) {
      throw new Error("the fixture should decode");
    }

    expect(hasCapability(exit.value, "audio")).toBe(true);
    expect(hasCapability(exit.value, "publish")).toBe(false);
  });

  it("refuses every capability of a disabled connection", () => {
    const exit = decodeConnection(connected);
    if (!Exit.isSuccess(exit)) {
      throw new Error("the fixture should decode");
    }

    expect(hasCapability({ ...exit.value, disabled: true }, "audio")).toBe(
      false
    );
  });
});

describe("a provider in the catalogue", () => {
  it("decodes one that names its ways in and what it can do", () => {
    const exit = decodeProvider({
      authorization: ["api-key"],
      capabilities: ["audio"],
      id: "elevenlabs",
      name: "ElevenLabs",
    });

    expect(Exit.isSuccess(exit)).toBe(true);
  });

  it("refuses a provider that offers no way in", () => {
    const exit = decodeProvider({
      authorization: [],
      capabilities: ["audio"],
      id: "elevenlabs",
      name: "ElevenLabs",
    });

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("refuses a provider that can do nothing", () => {
    const exit = decodeProvider({
      authorization: ["api-key"],
      capabilities: [],
      id: "elevenlabs",
      name: "ElevenLabs",
    });

    expect(Exit.isFailure(exit)).toBe(true);
  });
});

const decodeAttempt = Schema.decodeUnknownExit(ConnectionAttempt);
const decodeRemoval = Schema.decodeUnknownExit(ConnectionRemoval);
const decodeDraft = Schema.decodeUnknownExit(ConnectionDraft);

describe("the shapes an integration request and its answer take", () => {
  it("takes a secret going in", () => {
    const exit = decodeDraft({
      authorization: "api-key",
      provider: "elevenlabs",
      secret: "sk-live-1",
    });

    expect(Exit.isSuccess(exit)).toBe(true);
  });

  it("takes no secret for a trip to the browser", () => {
    const exit = decodeDraft({
      authorization: "browser",
      provider: "youtube",
      secret: null,
    });

    expect(Exit.isSuccess(exit)).toBe(true);
  });

  it("refuses an authorization the studio does not know", () => {
    const exit = decodeDraft({
      authorization: "carrier-pigeon",
      provider: "elevenlabs",
      secret: null,
    });

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("answers a checked attempt with the account and nothing secret", () => {
    const exit = decodeAttempt({
      account: "studio@remocn.dev",
      capabilities: ["audio"],
      provider: "elevenlabs",
      secret: "sk-live-must-never-arrive",
      token: "must-never-arrive",
    });

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(JSON.stringify(exit.value)).not.toContain("must-never-arrive");
    }
  });

  it("answers a removal by saying whether the service was told", () => {
    const told = decodeRemoval({ detail: null, withdrawn: true });
    const untold = decodeRemoval({
      detail:
        "YouTube could not be reached, so the credential may still be valid there.",
      withdrawn: false,
    });

    expect(Exit.isSuccess(told)).toBe(true);
    expect(Exit.isSuccess(untold)).toBe(true);
  });
});
