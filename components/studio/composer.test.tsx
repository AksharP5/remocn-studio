import { beforeEach, describe, expect, it, mock } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCallback } from "react";
import { Composer } from "@/components/studio/composer";
import { SoundPrompt } from "@/components/studio/sound-prompt";
import { SoundResultCard } from "@/components/studio/sound-result-card";
import { StudioProvider, useStudio } from "@/components/studio/studio-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Connection } from "@/shared/integrations";
import type {
  Project,
  PromptElement,
  PromptParams,
  SessionMode,
  Video,
} from "@/shared/ipc";
import { SOUND_RESULT } from "@/test/fixtures/sound-result";

interface ComposerShape {
  completed?: boolean;
  isRunning?: boolean;
  isWaiting?: boolean;
  mode?: SessionMode;
  onModeChange?: (value: string) => void;
  soundCard?: boolean;
}

const PICKED = ["/Users/me/Desktop/shot.png"];

const PROJECT: Project = {
  createdAt: 1_700_000_000_000,
  id: "project-1",
  missing: false,
  name: "my-video",
  path: "/Users/me/projects/my-video",
  updatedAt: 1_700_000_000_000,
};

const VIDEO: Video = {
  compositionId: "my-video",
  createdAt: 1_700_000_000_000,
  deletedAt: null,
  id: "video-1",
  missing: false,
  name: "My video",
  projectId: PROJECT.id,
  updatedAt: 1_700_000_000_000,
};

const ELEMENT: PromptElement = {
  column: 7,
  component: "TitleCard",
  composition: "Main",
  file: "/Users/me/projects/my-video/src/TitleCard.tsx",
  fps: 30,
  frame: 42,
  html: "<h1>Hello</h1>",
  line: 12,
  scene: null,
  stack: [],
};

const RECT = { height: 0.2, width: 0.5, x: 0.25, y: 0.4 };

const SHOWS_TITLE = /^Show Title at/;
const SHOWS_RESOLVED = /^Show TitleCard at/;
const WRAPPED_NAME = /TitleBase/;

// `Title` is what `withSchema({ componentName: "Title" })` declares and what
// the pane shows in three places; `TitleBase` is the wrapped function, an
// implementation detail that is not exported and never appears in the pane.
const TARGET = {
  componentName: "Title",
  fields: [],
  identity: null,
  instanceId: "anchor-1",
  instances: 1,
  keys: [],
  name: null,
  ordinal: 1,
  origin: null,
  targetId: "anchor-1::Title",
  where: null,
};

const TUNED = {
  assetBase: null,
  assets: [],
  fonts: [],
  open: 0,
  originals: {},
  statuses: {},
  targets: [TARGET],
  text: null,
  video: null,
  window: null,
};

const READY = {
  attempt: 0,
  detail: null,
  logPath: "/tmp/sidecar.log",
  phase: "ready",
  pid: 1234,
};

const DOWN = {
  attempt: 4,
  detail: "the sidecar stopped with exit code 1",
  logPath: "/tmp/sidecar.log",
  phase: "down",
  pid: null,
};

const PASTED = "/Users/me/Library/Application Support/studio/pasted-images";
const ANY_REMOVE = /^Remove/;
const ANY_SHOW = /^Show TitleCard/;

const sent: PromptParams[] = [];
const SOUND_CONNECTION: Connection = {
  account: "My account",
  capabilities: ["audio"],
  detail: null,
  disabled: false,
  id: "sounds-1",
  name: "My sounds",
  provider: "elevenlabs",
  state: "connected",
};
let soundConnections: () =>
  | readonly Connection[]
  | Promise<readonly Connection[]> = () => [];

function mockShell(
  status: unknown,
  picked: string[] | null = PICKED,
  save: (at: number) => string = (at) => `${PASTED}/image-${at}.png`
) {
  let saved = 0;
  sent.length = 0;

  mockIPC(
    (cmd, payload) => {
      if (cmd === "plugin:dialog|open") {
        return picked;
      }
      if (cmd === "sidecar_status") {
        return status;
      }
      if (cmd === "integrations_list") {
        return soundConnections();
      }
      if (cmd === "save_pasted_image") {
        saved += 1;
        return save(saved);
      }
      if (cmd === "sidecar_request") {
        const request = payload as { method: string; params: unknown };
        if (request.method === "library.list") {
          return [SOUND_RESULT.asset];
        }
        if (request.method === "project.list") {
          return [PROJECT];
        }
        if (request.method === "video.list") {
          return [VIDEO];
        }
        if (request.method === "video.reconcile") {
          return [VIDEO];
        }
        if (request.method === "history.sessions") {
          return [];
        }
        if (request.method === "history.blocks") {
          return [];
        }
        if (request.method === "preview.start") {
          return new Promise(() => undefined);
        }
        if (request.method === "agent.prompt") {
          sent.push(request.params as PromptParams);
          (
            payload as { onStream: { onmessage: (event: unknown) => void } }
          ).onStream.onmessage({ text: "Your scene is ready.", type: "text" });
          return { context: null, failure: null, sessionId: "sdk-1" };
        }
        throw new Error(`unexpected sidecar method: ${request.method}`);
      }
      throw new Error(`unexpected command: ${cmd}`);
    },
    { shouldMockEvents: true }
  );

  const internals = window as unknown as {
    __TAURI_INTERNALS__: { convertFileSrc: (path: string) => string };
  };
  internals.__TAURI_INTERNALS__.convertFileSrc = (path) =>
    `asset://localhost/${encodeURIComponent(path)}`;
}

function pngFile(name: string) {
  return new File([new Uint8Array([137, 80, 78, 71])], name, {
    type: "image/png",
  });
}

function paste(textarea: HTMLElement, files: File[]) {
  return fireEvent.paste(textarea, { clipboardData: { files } });
}

function setCaret(textarea: HTMLElement, at: number) {
  (textarea as HTMLTextAreaElement).setSelectionRange(at, at);
}

function textOf(textarea: HTMLElement) {
  return (textarea as HTMLTextAreaElement).value;
}

function mirrorOf(textarea: HTMLElement) {
  const mirror = textarea.previousElementSibling;
  if (mirror === null) {
    throw new Error("the composer has no overlay");
  }
  return mirror as HTMLElement;
}

function typeInto(textarea: HTMLElement, value: string) {
  fireEvent.change(textarea, { target: { value } });
  (textarea as HTMLTextAreaElement).setSelectionRange(
    value.length,
    value.length
  );
}

// Starting, then ready — by the clock, not by a call count. Counting calls
// assumed exactly one consumer of the status, so a second one anywhere in the
// tree silently ate the "starting" answer this test exists to see. The flip
// lands between the first read and `settle`'s 700 ms retry.
const SECOND_LOOK_MS = 200;

function mockShellReadyOnSecondLook() {
  const from = Date.now();

  mockIPC(
    (cmd) => {
      if (cmd !== "sidecar_status") {
        throw new Error(`unexpected command: ${cmd}`);
      }
      return Date.now() - from < SECOND_LOOK_MS
        ? { ...READY, attempt: 1, phase: "starting", pid: null }
        : READY;
    },
    { shouldMockEvents: true }
  );
}

function CaptureProbe() {
  const { composer } = useStudio();
  const { capture } = composer;

  const take = useCallback(() => {
    capture(pngFile("Main-frame-42.png")).catch(() => undefined);
  }, [capture]);

  return (
    <button onClick={take} type="button">
      Take snapshot
    </button>
  );
}

function SelectProbe() {
  const { composer } = useStudio();
  const { select } = composer;

  const pick = useCallback(() => {
    select(ELEMENT, RECT, "make this bigger");
  }, [select]);

  const pickTuned = useCallback(() => {
    select(ELEMENT, RECT, "make this bigger", TUNED);
  }, [select]);

  return (
    <>
      <button onClick={pick} type="button">
        Pick element
      </button>
      <button onClick={pickTuned} type="button">
        Pick tuned element
      </button>
    </>
  );
}

async function renderComposer(
  _onSubmit = mock(),
  {
    soundCard = false,
    completed = false,
    isRunning = false,
    isWaiting = false,
    mode = "auto",
    onModeChange = mock(),
  }: ComposerShape = {}
) {
  render(
    <StudioProvider>
      <TooltipProvider>
        <SelectProbe />
        <CaptureProbe />
        <SoundSettingsProbe />
        {soundCard ? <SoundResultCard result={SOUND_RESULT} /> : null}
        <SoundPrompt disabled={isWaiting || isRunning} />
        <Composer
          canPickProvider={true}
          context={{ maxTokens: 200_000, totalTokens: 50_000 }}
          cwd={PROJECT.path}
          disabled={false}
          isRunning={isRunning}
          isWaiting={isWaiting}
          mode={mode}
          onModeChange={onModeChange}
          onProviderChange={mock()}
          onStop={mock()}
          provider="claude"
        />
      </TooltipProvider>
    </StudioProvider>
  );

  const textarea = await screen.findByRole("textbox", {
    name: "Message Claude",
  });
  if (completed) {
    typeInto(textarea, "Create a scene");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(textarea).toHaveValue(""));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Generate sound" })
      ).toBeVisible()
    );
    sent.length = 0;
  }
  return { onModeChange, textarea };
}

function SoundSettingsProbe() {
  const { settingsView } = useStudio();
  return (
    <output aria-label="Settings destination">
      {settingsView.isOpen ? settingsView.section : "closed"}
    </output>
  );
}

describe("Composer", () => {
  beforeEach(() => {
    soundConnections = () => [];
    mockShell(READY);
  });

  it("uses a sound from its result card without sending or clearing the draft", async () => {
    const { textarea } = await renderComposer(mock(), { soundCard: true });
    typeInto(textarea, "My unfinished request");
    await userEvent.click(screen.getByRole("button", { name: "Use in video" }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].assets[0]).toMatchObject({ slug: SOUND_RESULT.asset.slug });
    expect(sent[0].prompt).not.toContain("My unfinished request");
    expect(textarea).toHaveValue("My unfinished request");
    expect(
      await screen.findByRole("button", { name: "Request sent" })
    ).toBeDisabled();
  });

  it("regenerates by adding editable original parameters without sending", async () => {
    const { textarea } = await renderComposer(mock(), { soundCard: true });
    typeInto(textarea, "Keep my draft.");
    await userEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(textOf(textarea)).toContain("Keep my draft.");
    expect(textOf(textarea)).toContain(SOUND_RESULT.request.text);
    expect(textOf(textarea)).toContain("2 seconds");
    expect(textOf(textarea)).toContain(SOUND_RESULT.request.format);
    expect(textarea).toHaveFocus();
    expect(sent).toHaveLength(0);
  });

  it("hides the sound shortcut in a new chat", async () => {
    await renderComposer();
    expect(screen.queryByRole("button", { name: "Generate sound" })).toBeNull();
  });

  it("hides the sound shortcut while a turn is running", async () => {
    await renderComposer(mock(), { isRunning: true });
    expect(screen.queryByRole("button", { name: "Generate sound" })).toBeNull();
  });

  it("offers an English sound prompt, focuses it and waits for the person to send", async () => {
    soundConnections = () => [SOUND_CONNECTION];
    const { textarea } = await renderComposer(mock(), { completed: true });
    await userEvent.click(
      screen.getByRole("button", { name: "Generate sound" })
    );
    await waitFor(() =>
      expect(textarea).toHaveValue("Generate a sound effect: ")
    );
    expect(textarea).toHaveFocus();
    expect((textarea as HTMLTextAreaElement).selectionStart).toBe(
      textOf(textarea).length
    );
    expect(sent).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Generate sound" })).toBeNull();
  });

  it.each(["missing", "disabled", "needs-authorization"])(
    "opens Integrations when ElevenLabs is %s",
    async (state) => {
      soundConnections = () =>
        state === "missing"
          ? []
          : [
              {
                ...SOUND_CONNECTION,
                disabled: state === "disabled",
                state:
                  state === "needs-authorization"
                    ? "needs-authorization"
                    : "connected",
              },
            ];
      const { textarea } = await renderComposer(mock(), { completed: true });
      await userEvent.click(
        screen.getByRole("button", { name: "Generate sound" })
      );
      await waitFor(() =>
        expect(screen.getByLabelText("Settings destination")).toHaveTextContent(
          "integrations"
        )
      );
      expect(textarea).toHaveValue("");
      expect(sent).toHaveLength(0);
    }
  );

  it("keeps text entered while the connection check is pending", async () => {
    const reply = Promise.withResolvers<readonly Connection[]>();
    soundConnections = () => reply.promise;
    const { textarea } = await renderComposer(mock(), { completed: true });
    await userEvent.click(
      screen.getByRole("button", { name: "Generate sound" })
    );
    expect(
      screen.getByRole("button", { name: "Generate sound" })
    ).toBeDisabled();
    typeInto(textarea, "My own message");
    await act(async () => {
      reply.resolve([SOUND_CONNECTION]);
      await reply.promise;
    });
    await waitFor(() => expect(textarea).toHaveValue("My own message"));
    expect(sent).toHaveLength(0);
  });

  it("shows a connection error and allows retrying the sound shortcut", async () => {
    soundConnections = () => {
      throw new Error("Connections are unavailable");
    };
    const { textarea } = await renderComposer(mock(), { completed: true });
    await userEvent.click(
      screen.getByRole("button", { name: "Generate sound" })
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Connections are unavailable"
    );
    soundConnections = () => [SOUND_CONNECTION];
    await userEvent.click(
      screen.getByRole("button", { name: "Generate sound" })
    );
    await waitFor(() =>
      expect(textarea).toHaveValue("Generate a sound effect: ")
    );
  });

  it("hides the sound shortcut while waiting for approval", async () => {
    await renderComposer(mock(), { isWaiting: true });
    expect(screen.queryByRole("button", { name: "Generate sound" })).toBeNull();
  });

  it("offers the mode, the model and the effort next to the send button", async () => {
    await renderComposer();

    expect(screen.getByRole("button", { name: "Mode: Auto" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Model: Opus 5" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Effort: Default" })
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("says the message will be queued while a turn is running", async () => {
    const { textarea } = await renderComposer(mock(), { isRunning: true });

    expect(screen.getByRole("button", { name: "Stop" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Queue" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull();

    fireEvent.change(textarea, { target: { value: "then export it" } });

    expect(await screen.findByRole("button", { name: "Queue" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Stop" })).toBeVisible();
    expect(textarea).toBeEnabled();
  });

  it("picks a mode from the menu", async () => {
    const { onModeChange } = await renderComposer();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Mode: Auto" }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: "Plan" })
    );

    expect(onModeChange).toHaveBeenCalledWith("plan", expect.anything());
  });

  it("shows the mode the open session is already in", async () => {
    await renderComposer(mock(), { mode: "acceptEdits" });

    expect(
      screen.getByRole("button", { name: "Mode: Accept edits" })
    ).toBeVisible();
  });

  // Claude Code takes Auto from a model that cannot run it and downgrades to
  // `default` in silence, so the chip has to report the mode the turn will
  // really run in — measured: Haiku 4.5 comes back `default`.
  it("reports the mode a model without Auto will really run in, and says why", async () => {
    await renderComposer();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Model: Opus 5" }));
    await user.click(await screen.findByText("Claude", { selector: "span" }));
    fireEvent.click(
      await screen.findByRole("menuitemradio", { name: "Haiku 4.5" })
    );

    const chip = await screen.findByRole("button", {
      name: "Mode: Default — Haiku 4.5 does not offer Auto",
    });
    expect(chip).toBeVisible();

    fireEvent.click(chip);
    expect(
      await screen.findByRole("menuitemradio", { name: "Auto" })
    ).toHaveAttribute("aria-disabled", "true");
  });

  // Base UI's MenuItem closes on click; its RadioItem and CheckboxItem default
  // to `closeOnClick: false`, so every single-select menu here stayed open over
  // the composer it is anchored above — and the next click, aimed at the text
  // field, landed on whatever row was under the pointer and silently changed
  // the setting again.
  it("closes the mode menu once a mode is chosen", async () => {
    await renderComposer();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Mode: Auto" }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: "Plan" })
    );

    await waitFor(() =>
      expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument()
    );
  });

  it("closes the effort menu once a level is chosen", async () => {
    await renderComposer();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Effort: Default" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Max" }));

    await waitFor(() =>
      expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: "Effort: Max" })).toBeVisible();
  });

  it("closes the model menu once a model is chosen", async () => {
    await renderComposer();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Model: Opus 5" }));
    await user.click(await screen.findByText("Claude", { selector: "span" }));
    fireEvent.click(
      await screen.findByRole("menuitemradio", { name: "Haiku 4.5" })
    );

    await waitFor(() =>
      expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument()
    );
    expect(
      screen.getByRole("button", { name: "Model: Haiku 4.5" })
    ).toBeVisible();
  });

  // macOS substitution turned `git status --short` into `git status —short`
  // on the way to the agent, and the raw prompt is what the transcript stores,
  // so the damage outlived the turn.
  it("takes what was typed verbatim, without macOS substitution", async () => {
    const { textarea } = await renderComposer();

    expect(textarea).toHaveAttribute("autocorrect", "off");
    expect(textarea).toHaveAttribute("autocapitalize", "off");
  });

  // The chip is the only thing left on screen once the pane closes, so a name
  // the person never saw is a record of what they tuned labelled with nothing
  // they interacted with.
  it("names a tuned element the way the properties pane does", async () => {
    await renderComposer();

    fireEvent.click(screen.getByRole("button", { name: "Pick tuned element" }));

    expect(
      await screen.findByRole("button", { name: SHOWS_TITLE })
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: WRAPPED_NAME })
    ).not.toBeInTheDocument();
  });

  it("falls back to the resolved component for a selection with no schema", async () => {
    await renderComposer();

    fireEvent.click(screen.getByRole("button", { name: "Pick element" }));

    expect(
      await screen.findByRole("button", { name: SHOWS_RESOLVED })
    ).toBeVisible();
  });

  it("picks an effort level from the menu", async () => {
    await renderComposer();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Effort: Default" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Max" }));

    expect(screen.getByRole("button", { name: "Effort: Max" })).toBeVisible();
  });

  it("shows how much of the context window is gone", async () => {
    await renderComposer();

    expect(screen.getByTitle("Context used: 25%")).toBeInTheDocument();
  });

  it("attaches a picked image and sends it with the message", async () => {
    const { textarea } = await renderComposer();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Add to this message" })
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Add image" })
    );

    expect(await screen.findByRole("img", { name: "shot.png" })).toBeVisible();

    fireEvent.change(textarea, {
      target: { value: "[Image #1] use this frame" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].prompt).toBe("[Image #1] use this frame");
    expect(sent[0].attachments).toEqual([
      {
        mediaType: "image/png",
        name: "shot.png",
        path: "/Users/me/Desktop/shot.png",
      },
    ]);
  });

  it("refuses to send while the sidecar is down, and offers a restart", async () => {
    mockShell(DOWN);
    const { textarea } = await renderComposer();

    fireEvent.change(textarea, { target: { value: "build a scene" } });

    expect(
      await screen.findByText("The sidecar is not running.")
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Restart it" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("notices the sidecar came up even if it missed the event", async () => {
    mockShellReadyOnSecondLook();
    await renderComposer();

    expect(await screen.findByText("Starting the sidecar…")).toBeVisible();

    await waitFor(
      () =>
        expect(
          screen.queryByText("Starting the sidecar…")
        ).not.toBeInTheDocument(),
      { timeout: 3000 }
    );
  });

  it("says the sidecar is coming up instead of waiting silently", async () => {
    mockShell({ ...READY, attempt: 1, phase: "starting", pid: null });
    const { textarea } = await renderComposer();

    fireEvent.change(textarea, { target: { value: "build a scene" } });

    expect(await screen.findByText("Starting the sidecar…")).toBeVisible();
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("drops an attachment again", async () => {
    await renderComposer();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Add to this message" })
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Add image" })
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Remove shot.png" })
    );

    expect(screen.queryByRole("img", { name: "shot.png" })).toBeNull();
  });

  it("points at a picked image from the text too", async () => {
    const { textarea } = await renderComposer();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Add to this message" })
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Add image" })
    );

    await waitFor(() =>
      expect((textarea as HTMLTextAreaElement).value).toBe("[Image #1] ")
    );
  });

  it("attaches a pasted image and points at it from where the caret was", async () => {
    const { textarea } = await renderComposer();

    typeInto(textarea, "look at ");
    paste(textarea, [pngFile("shot.png")]);

    expect(
      await screen.findByRole("img", { name: "image-1.png" })
    ).toBeVisible();
    await waitFor(() =>
      expect((textarea as HTMLTextAreaElement).value).toBe(
        "look at [Image #1] "
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].prompt).toBe("look at [Image #1]");
    expect(sent[0].attachments).toEqual([
      {
        mediaType: "image/png",
        name: "image-1.png",
        path: `${PASTED}/image-1.png`,
      },
    ]);
  });

  it("lands a snapshot in the composer as an ordinary attachment", async () => {
    mockShell(READY, PICKED, () => `${PASTED}/Main-frame-42.png`);
    const { textarea } = await renderComposer();

    typeInto(textarea, "this is too cramped ");
    fireEvent.click(screen.getByRole("button", { name: "Take snapshot" }));

    expect(
      await screen.findByRole("img", { name: "Main-frame-42.png" })
    ).toBeVisible();
    await waitFor(() =>
      expect(textOf(textarea)).toBe("this is too cramped [Image #1] ")
    );

    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].prompt).toBe("this is too cramped [Image #1]");
    expect(sent[0].attachments).toEqual([
      {
        mediaType: "image/png",
        name: "Main-frame-42.png",
        path: `${PASTED}/Main-frame-42.png`,
      },
    ]);
  });

  it("drops a bad snapshot the way any attachment is dropped", async () => {
    mockShell(READY, PICKED, () => `${PASTED}/Main-frame-42.png`);
    const { textarea } = await renderComposer();

    fireEvent.click(screen.getByRole("button", { name: "Take snapshot" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Remove Main-frame-42.png" })
    );

    expect(screen.queryByRole("img", { name: "Main-frame-42.png" })).toBeNull();
    expect(textOf(textarea)).toBe("");
  });

  it("keeps the file's own name", async () => {
    mockShell(READY, PICKED, () => `${PASTED}/desk-reference.jpg`);
    const { textarea } = await renderComposer();

    paste(textarea, [pngFile("desk-reference.jpg")]);

    expect(
      await screen.findByRole("img", { name: "desk-reference.jpg" })
    ).toBeVisible();
  });

  it("shows the picture on the card, not just its name", async () => {
    const { textarea } = await renderComposer();

    paste(textarea, [pngFile("shot.png")]);

    expect(
      await screen.findByRole("img", { name: "image-1.png" })
    ).toHaveAttribute("src", expect.stringContaining("asset://localhost/"));
  });

  it("falls back to an icon when the file cannot be read", async () => {
    const { textarea } = await renderComposer();

    paste(textarea, [pngFile("shot.png")]);
    fireEvent.error(await screen.findByRole("img", { name: "image-1.png" }));

    expect(screen.queryByRole("img", { name: "image-1.png" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Remove image-1.png" })
    ).toBeVisible();
  });

  it("numbers a run of pasted images in the order they arrived", async () => {
    const { textarea } = await renderComposer();

    typeInto(textarea, "compare ");
    paste(textarea, [pngFile("one.png"), pngFile("two.png")]);

    await waitFor(() =>
      expect((textarea as HTMLTextAreaElement).value).toBe(
        "compare [Image #1] [Image #2] "
      )
    );
  });

  it("renumbers what is left when an attachment goes", async () => {
    const { textarea } = await renderComposer();

    typeInto(textarea, "compare ");
    paste(textarea, [pngFile("one.png"), pngFile("two.png")]);

    fireEvent.click(
      await screen.findByRole("button", { name: "Remove image-1.png" })
    );

    await waitFor(() =>
      expect((textarea as HTMLTextAreaElement).value).toBe(
        "compare [Image #1] "
      )
    );
    expect(screen.queryByRole("img", { name: "image-1.png" })).toBeNull();
    expect(screen.getByRole("img", { name: "image-2.png" })).toBeVisible();
  });

  it("takes the whole reference, and its card, on one backspace", async () => {
    const { textarea } = await renderComposer();

    typeInto(textarea, "compare ");
    paste(textarea, [pngFile("one.png"), pngFile("two.png")]);
    await waitFor(() =>
      expect(textOf(textarea)).toBe("compare [Image #1] [Image #2] ")
    );

    setCaret(textarea, 18);
    fireEvent.keyDown(textarea, { key: "Backspace" });

    await waitFor(() => expect(textOf(textarea)).toBe("compare [Image #1] "));
    expect(screen.queryByRole("img", { name: "image-1.png" })).toBeNull();
    expect(screen.getByRole("img", { name: "image-2.png" })).toBeVisible();
  });

  it("takes the card when the reference is deleted wholesale", async () => {
    const { textarea } = await renderComposer();

    typeInto(textarea, "compare ");
    paste(textarea, [pngFile("one.png"), pngFile("two.png")]);
    await waitFor(() =>
      expect(textOf(textarea)).toBe("compare [Image #1] [Image #2] ")
    );

    fireEvent.change(textarea, {
      target: { value: "compare  [Image #2] " },
    });

    await waitFor(() => expect(textOf(textarea)).toBe("compare  [Image #1] "));
    expect(screen.queryByRole("img", { name: "image-1.png" })).toBeNull();
    expect(screen.getByRole("img", { name: "image-2.png" })).toBeVisible();
  });

  it("leaves an ordinary backspace to the browser", async () => {
    const { textarea } = await renderComposer();

    paste(textarea, [pngFile("one.png")]);
    await waitFor(() => expect(textOf(textarea)).toBe("[Image #1] "));

    setCaret(textarea, 11);
    const event = createEvent.keyDown(textarea, { key: "Backspace" });
    fireEvent(textarea, event);

    expect(event.defaultPrevented).toBe(false);
    expect(screen.getByRole("img", { name: "image-1.png" })).toBeVisible();
  });

  it("leaves an ordinary text paste alone", async () => {
    const { textarea } = await renderComposer();

    const event = createEvent.paste(textarea, {
      clipboardData: { files: [] },
    });
    fireEvent(textarea, event);

    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByRole("button", { name: ANY_REMOVE })).toBeNull();
  });

  it("says why a paste did not land instead of ignoring it", async () => {
    mockShell(READY, PICKED, () => {
      throw new Error("there is no app data directory");
    });
    const { textarea } = await renderComposer();

    paste(textarea, [pngFile("shot.png")]);

    expect(
      await screen.findByText("there is no app data directory")
    ).toBeVisible();
  });

  it("writes the comment and its token where the caret was", async () => {
    const { textarea } = await renderComposer();

    typeInto(textarea, "in the intro, ");
    fireEvent.click(screen.getByRole("button", { name: "Pick element" }));

    await waitFor(() =>
      expect(textOf(textarea)).toBe(
        "in the intro, make this bigger [Element #1] "
      )
    );
  });

  it("shows the selection as a chip naming the component and the time", async () => {
    await renderComposer();

    fireEvent.click(screen.getByRole("button", { name: "Pick element" }));

    expect(
      await screen.findByRole("button", { name: "Show TitleCard at 0:01.4" })
    ).toBeVisible();
  });

  it("numbers the tokens and the chips alike", async () => {
    const { textarea } = await renderComposer();

    fireEvent.click(screen.getByRole("button", { name: "Pick element" }));
    await waitFor(() => expect(textOf(textarea)).toContain("[Element #1]"));
    fireEvent.click(screen.getByRole("button", { name: "Pick element" }));

    await waitFor(() => expect(textOf(textarea)).toContain("[Element #2]"));
    expect(screen.getAllByRole("button", { name: ANY_SHOW })).toHaveLength(2);
  });

  it("counts images and elements on separate ladders", async () => {
    const { textarea } = await renderComposer();

    paste(textarea, [pngFile("one.png")]);
    await waitFor(() => expect(textOf(textarea)).toBe("[Image #1] "));
    fireEvent.click(screen.getByRole("button", { name: "Pick element" }));

    await waitFor(() =>
      expect(textOf(textarea)).toBe("[Image #1] make this bigger [Element #1] ")
    );
  });

  it("takes the selection with its token on one backspace", async () => {
    const { textarea } = await renderComposer();

    fireEvent.click(screen.getByRole("button", { name: "Pick element" }));
    await waitFor(() =>
      expect(textOf(textarea)).toBe("make this bigger [Element #1] ")
    );

    setCaret(textarea, 29);
    fireEvent.keyDown(textarea, { key: "Backspace" });

    await waitFor(() => expect(textOf(textarea)).toBe("make this bigger "));
    expect(screen.queryByRole("button", { name: ANY_SHOW })).toBeNull();
  });

  it("drops the selection when its chip is closed", async () => {
    const { textarea } = await renderComposer();

    fireEvent.click(screen.getByRole("button", { name: "Pick element" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Remove TitleCard" })
    );

    await waitFor(() => expect(textOf(textarea)).toBe("make this bigger "));
    expect(screen.queryByRole("button", { name: ANY_SHOW })).toBeNull();
  });

  it("sends the selection with the message", async () => {
    const { textarea } = await renderComposer();

    fireEvent.click(screen.getByRole("button", { name: "Pick element" }));
    await waitFor(() => expect(textOf(textarea)).toContain("[Element #1]"));
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].elements).toEqual([ELEMENT]);
    expect(sent[0].prompt).toBe("make this bigger [Element #1]");
  });

  it("terminates the overlay so a trailing newline keeps its line", async () => {
    const { textarea } = await renderComposer();

    typeInto(textarea, "one\ntwo\n");

    expect(mirrorOf(textarea).textContent).toBe("one\ntwo\n\u200b");
  });

  it("follows the field's scroll on every change, not only on a scroll", async () => {
    const { textarea } = await renderComposer();
    const mirror = mirrorOf(textarea);

    typeInto(textarea, "a long draft");
    textarea.scrollTop = 30;
    mirror.scrollTop = 0;

    typeInto(textarea, "a long drafts");

    expect(mirror.scrollTop).toBe(30);
  });

  it("inserts a music prompt without submitting or spending credits", async () => {
    soundConnections = () => [SOUND_CONNECTION];
    const { textarea } = await renderComposer(mock(), { completed: true });
    await userEvent.click(
      screen.getByRole("button", { name: "Generate music" })
    );
    await waitFor(() =>
      expect(textarea).toHaveValue("Generate instrumental music: ")
    );
    expect(textarea).toHaveFocus();
    expect(sent).toHaveLength(0);
  });

  it("opens Integrations when music has no usable connection", async () => {
    soundConnections = () => [];
    const { textarea } = await renderComposer(mock(), { completed: true });
    await userEvent.click(
      screen.getByRole("button", { name: "Generate music" })
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Settings destination")).toHaveTextContent(
        "integrations"
      )
    );
    expect(textarea).toHaveValue("");
    expect(sent).toHaveLength(0);
  });
});
