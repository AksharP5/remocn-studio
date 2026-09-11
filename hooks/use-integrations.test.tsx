import { describe, expect, it } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useIntegrations } from "@/hooks/use-integrations";

const PROVIDER = {
  authorization: ["api-key"],
  capabilities: ["audio"],
  id: "elevenlabs",
  name: "ElevenLabs",
};

const CONNECTION = {
  account: "studio@remocn.dev",
  capabilities: ["audio"],
  detail: null,
  disabled: false,
  id: "cn_1",
  name: "My ElevenLabs",
  provider: "elevenlabs",
  state: "connected",
};

function studio(
  options: {
    begin?: unknown;
    confirm?: unknown;
    connections?: unknown[];
    remove?: unknown;
  } = {}
) {
  const seen: { args: unknown; cmd: string }[] = [];
  let listed = options.connections ?? [];

  mockIPC((cmd, args) => {
    seen.push({ args, cmd });

    if (cmd === "integrations_catalogue") {
      return [PROVIDER];
    }
    if (cmd === "integrations_list") {
      return listed;
    }
    if (cmd === "integrations_begin") {
      const answer = options.begin ?? {
        account: "studio@remocn.dev",
        capabilities: ["audio"],
        provider: "elevenlabs",
      };
      if (answer instanceof Error) {
        throw answer;
      }
      return answer;
    }
    if (cmd === "integrations_confirm") {
      const answer = options.confirm ?? CONNECTION;
      if (answer instanceof Error) {
        throw answer;
      }
      listed = [CONNECTION];
      return answer;
    }
    if (cmd === "integrations_remove") {
      const answer = options.remove ?? { detail: null, withdrawn: true };
      if (answer instanceof Error) {
        throw answer;
      }
      listed = [];
      return answer;
    }
    if (cmd === "integrations_cancel") {
      return null;
    }
    if (cmd === "integrations_set_disabled") {
      listed = [{ ...CONNECTION, disabled: true }];
      return { ...CONNECTION, disabled: true };
    }
    if (cmd === "integrations_check") {
      return CONNECTION;
    }
    throw new Error(`no answer for ${cmd}`);
  });

  return seen;
}

describe("adding an integration", () => {
  it("offers the catalogue the core holds", async () => {
    studio();
    const { result } = renderHook(() => useIntegrations());

    await waitFor(() => expect(result.current.catalogue).toHaveLength(1));
    expect(result.current.catalogue[0]?.name).toBe("ElevenLabs");
  });

  it("goes choose, check, name, and only then holds a connection", async () => {
    studio();
    const { result } = renderHook(() => useIntegrations());
    await waitFor(() => expect(result.current.catalogue).toHaveLength(1));

    act(() => result.current.onOpenAdd());
    expect(result.current.step).toBe("picking");

    act(() => result.current.onChoose(PROVIDER));
    expect(result.current.step).toBe("chosen");

    act(() => result.current.onSubmitSecret("sk-live-1"));
    await waitFor(() => expect(result.current.step).toBe("naming"));
    expect(result.current.attempt?.account).toBe("studio@remocn.dev");
    expect(result.current.connections).toHaveLength(0);

    act(() => result.current.onConfirm("My ElevenLabs"));
    await waitFor(() => expect(result.current.connections).toHaveLength(1));
    expect(result.current.step).toBe("closed");
  });

  it("keeps the check's refusal and makes no connection", async () => {
    studio({ begin: new Error("ElevenLabs rejected that key.") });
    const { result } = renderHook(() => useIntegrations());
    await waitFor(() => expect(result.current.catalogue).toHaveLength(1));

    act(() => result.current.onOpenAdd());
    act(() => result.current.onChoose(PROVIDER));
    act(() => result.current.onSubmitSecret("wrong"));

    await waitFor(() =>
      expect(result.current.error).toContain("rejected that key")
    );
    expect(result.current.step).toBe("chosen");
    expect(result.current.connections).toHaveLength(0);
  });

  it("stores nothing when the add is cancelled halfway", async () => {
    const seen = studio();
    const { result } = renderHook(() => useIntegrations());
    await waitFor(() => expect(result.current.catalogue).toHaveLength(1));

    act(() => result.current.onOpenAdd());
    act(() => result.current.onChoose(PROVIDER));
    act(() => result.current.onSubmitSecret("sk-live-1"));
    await waitFor(() => expect(result.current.step).toBe("naming"));

    act(() => result.current.onCancelAdd());

    await waitFor(() =>
      expect(seen.some((one) => one.cmd === "integrations_cancel")).toBe(true)
    );
    expect(result.current.step).toBe("closed");
    expect(result.current.attempt).toBeNull();
    expect(seen.some((one) => one.cmd === "integrations_confirm")).toBe(false);
  });

  it("reports a keychain that refuses and adds no row", async () => {
    studio({ confirm: new Error("The keychain refused: it is locked.") });
    const { result } = renderHook(() => useIntegrations());
    await waitFor(() => expect(result.current.catalogue).toHaveLength(1));

    act(() => result.current.onOpenAdd());
    act(() => result.current.onChoose(PROVIDER));
    act(() => result.current.onSubmitSecret("sk-live-1"));
    await waitFor(() => expect(result.current.step).toBe("naming"));

    act(() => result.current.onConfirm("Mine"));

    await waitFor(() =>
      expect(result.current.error).toContain("The keychain refused")
    );
    expect(result.current.connections).toHaveLength(0);
    expect(result.current.step).toBe("naming");
  });
});

describe("living with a connection", () => {
  it("lists what was there before", async () => {
    studio({ connections: [CONNECTION] });
    const { result } = renderHook(() => useIntegrations());

    await waitFor(() => expect(result.current.connections).toHaveLength(1));
    expect(result.current.connections[0]?.name).toBe("My ElevenLabs");
  });

  it("carries a disable through to the list", async () => {
    studio({ connections: [CONNECTION] });
    const { result } = renderHook(() => useIntegrations());
    await waitFor(() => expect(result.current.connections).toHaveLength(1));

    act(() => result.current.onToggleDisabled("cn_1", true));

    await waitFor(() =>
      expect(result.current.connections[0]?.disabled).toBe(true)
    );
  });

  it("takes a removed connection out of the list", async () => {
    studio({ connections: [CONNECTION] });
    const { result } = renderHook(() => useIntegrations());
    await waitFor(() => expect(result.current.connections).toHaveLength(1));

    act(() => result.current.onRemove("cn_1"));

    await waitFor(() => expect(result.current.connections).toHaveLength(0));
    expect(result.current.notice).toBeNull();
  });

  it("says so when the service could not be told about a removal", async () => {
    studio({
      connections: [CONNECTION],
      remove: {
        detail: "ElevenLabs could not be reached, so the key may still work there.",
        withdrawn: false,
      },
    });
    const { result } = renderHook(() => useIntegrations());
    await waitFor(() => expect(result.current.connections).toHaveLength(1));

    act(() => result.current.onRemove("cn_1"));

    await waitFor(() =>
      expect(result.current.notice).toContain("could not be reached")
    );
    expect(result.current.connections).toHaveLength(0);
  });
});
