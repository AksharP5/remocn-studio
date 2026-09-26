import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import type { AgentEvent, PromptParams, TranscriptEntry } from "@/shared/ipc";
import { appendUser, fold } from "@/shared/transcript";
import { migrate, prepare } from "@/sidecar/history/migrations";
import { recording } from "@/sidecar/history/recorder";
import { driverFor } from "@/sidecar/history/sqlite";
import { broken, type HistoryStore, make } from "@/sidecar/history/store";
import { SOUND_RESULT } from "@/test/fixtures/sound-result";

const PROJECT_ID = "project-1";
const VIDEO_ID = "video-1";

function store(): HistoryStore {
  const driver = driverFor(":memory:");

  prepare(driver);
  migrate(driver);
  driver.run(
    `INSERT INTO project (id, path, name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [PROJECT_ID, "/videos/promo", "promo", 0, 0]
  );
  driver.run(
    `INSERT INTO video (id, project_id, composition_id, name, present, created_at, updated_at, deleted_at)
     VALUES (?, ?, 'promo', 'Promo', 1, 0, 0, NULL)`,
    [VIDEO_ID, PROJECT_ID]
  );
  return make(driver);
}

function params(shape: Partial<PromptParams>): PromptParams {
  return {
    assets: [],
    attachments: [],
    effort: null,
    elements: [],
    historyId: crypto.randomUUID(),
    media: [],
    mode: "auto",
    model: null,
    playing: null,
    projectId: PROJECT_ID,
    prompt: "make a title card",
    provider: "claude",
    sessionId: null,
    videoId: VIDEO_ID,
    ...shape,
  };
}

const TURN: AgentEvent[] = [
  { mode: "auto", model: "claude-opus-5", sessionId: "sdk-7", type: "session" },
  { text: "Writing ", type: "text" },
  { text: "the scene.", type: "text" },
  {
    id: "toolu_1",
    input: { file_path: "/videos/promo/src/Main.tsx" },
    name: "Write",
    type: "tool_use",
    verb: "create",
  },
  { id: "toolu_1", isError: false, text: "written", type: "tool_result" },
  { text: "Done.", type: "text" },
];

function bare(entry: TranscriptEntry) {
  return Object.fromEntries(
    Object.entries(entry).filter(([key]) => key !== "id")
  );
}

function live(input: PromptParams, events: readonly AgentEvent[]) {
  return events
    .reduce(
      fold,
      appendUser([], {
        assets: input.assets,
        attachments: input.attachments,
        elements: input.elements,
        media: input.media,
        text: input.prompt,
      })
    )
    .map(bare);
}

const logged: string[] = [];
const log = (line: string) => Effect.sync(() => logged.push(line));

describe("recording", () => {
  it("stores exactly what the live transcript folds to", async () => {
    const history = store();
    const input = params({});

    const session = await Effect.runPromise(
      Effect.gen(function* () {
        const recorder = yield* recording(history, input, log);
        yield* Effect.forEach(TURN, recorder.event, { discard: true });
        yield* recorder.flush;
        return recorder.session;
      })
    );

    expect(session).not.toBeNull();

    const stored = await Effect.runPromise(history.blocks(session?.id ?? ""));
    expect(stored.map(bare)).toEqual(live(input, TURN));
  });

  it("leaves a readable prefix when the turn stops halfway", async () => {
    const history = store();
    const input = params({});
    const half = TURN.slice(0, 4);

    const session = await Effect.runPromise(
      Effect.gen(function* () {
        const recorder = yield* recording(history, input, log);
        yield* Effect.forEach(half, recorder.event, { discard: true });
        return recorder.session;
      })
    );

    const stored = await Effect.runPromise(history.blocks(session?.id ?? ""));
    expect(stored.map(bare)).toEqual(live(input, half));
    expect(stored.at(-1)).toMatchObject({ name: "Write", state: "running" });
  });

  it("appends a second turn after the first instead of overwriting it", async () => {
    const history = store();
    const first = params({ historyId: "history-1" });

    const session = await Effect.runPromise(
      Effect.gen(function* () {
        const recorder = yield* recording(history, first, log);
        yield* Effect.forEach(TURN, recorder.event, { discard: true });
        yield* recorder.flush;
        return recorder.session;
      })
    );

    const second = params({ historyId: "history-1", prompt: "now in red" });
    await Effect.runPromise(
      Effect.gen(function* () {
        const recorder = yield* recording(history, second, log);
        yield* recorder.event({ text: "Recolouring.", type: "text" });
        yield* recorder.flush;
      })
    );

    const stored = await Effect.runPromise(history.blocks(session?.id ?? ""));
    expect(stored.map(bare)).toEqual([
      ...live(first, TURN),
      ...live(second, [{ text: "Recolouring.", type: "text" }]),
    ]);
  });

  it("titles the session from the first message and keeps it", async () => {
    const history = store();
    const long = "a".repeat(200);

    const opened = await Effect.runPromise(
      recording(
        history,
        params({ historyId: "history-1", prompt: `  ${long}  ` }),
        log
      )
    );
    expect(opened.session?.title).toHaveLength(60);

    const again = await Effect.runPromise(
      recording(
        history,
        params({ historyId: "history-1", prompt: "a follow-up" }),
        log
      )
    );
    expect(again.session?.title).toBe(opened.session?.title);
  });

  it("names an image-only turn after its attachment", async () => {
    const history = store();

    const opened = await Effect.runPromise(
      recording(
        history,
        params({
          attachments: [
            {
              mediaType: "image/png",
              name: "board.png",
              path: "/tmp/board.png",
            },
          ],
          prompt: "",
        }),
        log
      )
    );

    expect(opened.session?.title).toBe("board.png");
  });

  it("calls a turn with no words and no attachment an untitled chat", async () => {
    const opened = await Effect.runPromise(
      recording(store(), params({ prompt: "   " }), log)
    );

    expect(opened.session?.title).toBe("Untitled chat");
  });

  it("binds the SDK session id so the next turn resumes it", async () => {
    const history = store();

    const session = await Effect.runPromise(
      Effect.gen(function* () {
        const recorder = yield* recording(history, params({}), log);
        yield* recorder.event(TURN[0]);
        return recorder.session;
      })
    );

    const [stored] = await Effect.runPromise(history.sessions);
    expect(stored.id).toBe(session?.id);
    expect(stored.sdkSessionId).toBe("sdk-7");
  });

  it("lets the turn run on when the database is unusable", async () => {
    const recorder = await Effect.runPromise(
      recording(broken("no disk"), params({}), log)
    );

    expect(recorder.session).toBeNull();
    await Effect.runPromise(
      recorder.event({ text: "still fine", type: "text" })
    );
    expect(logged).toContain("history: no disk");
  });
});

describe("streamed text", () => {
  function counting(history: HistoryStore) {
    const state = { writes: 0 };
    const wrapped: HistoryStore = {
      ...history,
      write: (block) => {
        state.writes += 1;
        return history.write(block);
      },
    };
    return { state, store: wrapped };
  }

  const deltas: AgentEvent[] = Array.from({ length: 200 }, (_, index) => ({
    text: `word${index} `,
    type: "text" as const,
  }));

  it("is written at a bounded rate rather than once per token", async () => {
    const { state, store: counted } = counting(store());
    const input = params({});

    await Effect.runPromise(
      Effect.gen(function* () {
        const recorder = yield* recording(counted, input, log);
        yield* Effect.forEach(deltas, recorder.event, { discard: true });
        yield* recorder.flush;
      })
    );

    const stored = await Effect.runPromise(counted.blocks(input.historyId));
    expect(stored.map(bare)).toEqual(live(input, deltas));
    expect(state.writes).toBeLessThanOrEqual(3);
  });

  it("reaches the database within a quarter second with no flush", async () => {
    const history = store();
    const input = params({});

    const stored = await Effect.runPromise(
      Effect.gen(function* () {
        const recorder = yield* recording(history, input, log);
        yield* recorder.event({ text: "Streaming", type: "text" });
        yield* TestClock.adjust("300 millis");
        return yield* history.blocks(input.historyId);
      }).pipe(Effect.provide(TestClock.layer()))
    );

    expect(stored.map(bare)).toEqual(
      live(input, [{ text: "Streaming", type: "text" }])
    );
  });

  it("is written before anything that is not text", async () => {
    const history = store();
    const input = params({});
    const events = TURN.slice(1, 4);

    await Effect.runPromise(
      Effect.gen(function* () {
        const recorder = yield* recording(history, input, log);
        yield* Effect.forEach(events, recorder.event, { discard: true });
      })
    );

    const stored = await Effect.runPromise(history.blocks(input.historyId));
    expect(stored.map(bare)).toEqual(live(input, events));
  });
});

it("persists a sound card and updates duplicate completion events in place", async () => {
  const history = store();
  const input = params({});
  const result = {
    ...SOUND_RESULT,
    asset: { ...SOUND_RESULT.asset, name: "New title" },
  };
  await Effect.runPromise(
    Effect.gen(function* () {
      const recorder = yield* recording(history, input, log);
      yield* recorder.event({ result: SOUND_RESULT, type: "sound_result" });
      yield* recorder.event({ result, type: "sound_result" });
    })
  );
  const stored = await Effect.runPromise(history.blocks(input.historyId));
  const sounds = stored.filter((entry) => entry.kind === "sound");
  expect(sounds).toHaveLength(1);
  expect(sounds[0]).toMatchObject({ kind: "sound", result });
  expect(JSON.stringify(sounds)).not.toContain("secret");
});
