import { describe, expect, it } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { Effect, Exit } from "effect";
import { causeMessage } from "@/lib/error-message";
import {
  beginConnection,
  checkConnection,
  readCatalogue,
  readConnections,
  removeConnection,
  replaceSecret,
  setConnectionDisabled,
} from "@/lib/studio/integrations";

const connection = {
  account: "studio@remocn.dev",
  capabilities: ["audio"],
  detail: null,
  disabled: false,
  id: "cn_1",
  name: "My ElevenLabs",
  provider: "elevenlabs",
  state: "connected",
};

function answering(answers: Record<string, unknown>) {
  const seen: { args: unknown; cmd: string }[] = [];

  mockIPC((cmd, args) => {
    seen.push({ args, cmd });
    if (cmd in answers) {
      const answer = answers[cmd];
      if (answer instanceof Error) {
        throw answer;
      }
      return answer;
    }
    throw new Error(`no answer for ${cmd}`);
  });

  return seen;
}

describe("reading what can be connected", () => {
  it("answers with the catalogue the core holds", async () => {
    answering({
      integrations_catalogue: [
        {
          authorization: ["api-key"],
          capabilities: ["audio"],
          id: "elevenlabs",
          name: "ElevenLabs",
        },
      ],
    });

    const exit = await Effect.runPromiseExit(readCatalogue);

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value[0]?.name).toBe("ElevenLabs");
    }
  });

  it("answers with an empty catalogue when nothing has an adapter", async () => {
    answering({ integrations_catalogue: [] });

    const exit = await Effect.runPromiseExit(readCatalogue);

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toHaveLength(0);
    }
  });

  it("lists the connections that exist", async () => {
    answering({ integrations_list: [connection] });

    const exit = await Effect.runPromiseExit(readConnections);

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value[0]?.name).toBe("My ElevenLabs");
    }
  });
});

describe("when the core refuses", () => {
  it("carries the core's own sentence", async () => {
    answering({
      integrations_list: new Error("The keychain refused: it is locked."),
    });

    const exit = await Effect.runPromiseExit(readConnections);

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(causeMessage(exit.cause)).toContain("The keychain refused");
    }
  });

  it("says so plainly when the answer cannot be read", async () => {
    answering({ integrations_list: [{ ...connection, state: "fine" }] });

    const exit = await Effect.runPromiseExit(readConnections);

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(causeMessage(exit.cause)).toContain("cannot read");
    }
  });
});

describe("the calls that change something", () => {
  it("sends a secret in, and gets an account back rather than the secret", async () => {
    const seen = answering({
      integrations_begin: {
        account: "studio@remocn.dev",
        capabilities: ["audio"],
        provider: "elevenlabs",
      },
    });

    const exit = await Effect.runPromiseExit(
      beginConnection({
        authorization: "api-key",
        provider: "elevenlabs",
        secret: "sk-live-1",
      })
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.account).toBe("studio@remocn.dev");
      expect(JSON.stringify(exit.value)).not.toContain("sk-live-1");
    }
    expect(JSON.stringify(seen[0]?.args)).toContain("sk-live-1");
  });

  it("names the connection it is checking", async () => {
    const seen = answering({ integrations_check: connection });

    await Effect.runPromiseExit(checkConnection("cn_1"));

    expect(seen[0]?.cmd).toBe("integrations_check");
    expect(seen[0]?.args).toMatchObject({ id: "cn_1" });
  });

  it("replaces a secret without asking for the old one", async () => {
    const seen = answering({ integrations_reconfigure: connection });

    await Effect.runPromiseExit(replaceSecret("cn_1", "sk-live-2"));

    expect(seen[0]?.args).toMatchObject({ id: "cn_1", secret: "sk-live-2" });
  });

  it("carries which way the switch went", async () => {
    const seen = answering({
      integrations_set_disabled: { ...connection, disabled: true },
    });

    const exit = await Effect.runPromiseExit(
      setConnectionDisabled("cn_1", true)
    );

    expect(seen[0]?.args).toMatchObject({ disabled: true, id: "cn_1" });
    if (Exit.isSuccess(exit)) {
      expect(exit.value.disabled).toBe(true);
    }
  });

  it("says whether the service was told about a removal", async () => {
    answering({
      integrations_remove: {
        detail: "ElevenLabs could not be reached.",
        withdrawn: false,
      },
    });

    const exit = await Effect.runPromiseExit(removeConnection("cn_1"));

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.withdrawn).toBe(false);
      expect(exit.value.detail).toContain("could not be reached");
    }
  });
});
