import { Effect, Exit, Ref } from "effect";
import { errorMessage } from "@/lib/error-message";
import type {
  AgentEvent,
  AgentFailure,
  PromptParams,
  PromptResult,
  SessionMode,
} from "@/shared/ipc";
import type { TurnServices } from "../agent/adapter";
import { announce, type KnowledgeBundle } from "../agent/knowledge";
import { elementsOf } from "../agent/prompt";
import { conventionsFor } from "../claude/conventions";
import type { AcpPeer } from "./connection";
import { type AcpBlock, blocksOf } from "./content";
import { makeAcpTranslator } from "./events";
import { answerPermission } from "./permission";
import { acpPool, type Held, type SessionModes } from "./pool";

// One turn over the Agent Client Protocol, shared by every adapter that
// speaks it: what varies per provider is only how the process is started,
// whether it can look at images, and how its failures are worded.
export interface AcpTurnConfig {
  readonly args: readonly string[];
  readonly classify: (text: string) => AgentFailure;
  readonly command: string;
  readonly images: boolean;
  readonly inBand: (firstChunk: string) => AgentFailure | null;
  readonly knowledge: KnowledgeBundle;
}

// ACP mode ids are URIs; the match is by fragment so a version bump that
// moves the prefix cannot silently strand every session in the default
// mode. acceptEdits maps to plain agent mode — an agent's allow-all mode
// (autopilot and its cousins) has no story here.
const MODE_FRAGMENTS: Record<SessionMode, string> = {
  acceptEdits: "agent",
  auto: "agent",
  plan: "plan",
};

interface OpenedSession {
  modes?: SessionModes;
  sessionId?: string;
}

export function acpTurn(
  config: AcpTurnConfig,
  params: PromptParams,
  services: TurnServices
): Effect.Effect<PromptResult> {
  return Effect.gen(function* () {
    const failure = yield* Ref.make<AgentFailure | null>(null);
    const opened = { sessionId: params.sessionId };
    const translator = makeAcpTranslator();

    yield* announce(config.knowledge, services);

    let replaying = false;
    let firstChunk = true;
    let delivering: Promise<void> = Promise.resolve();

    const deliver = (events: readonly AgentEvent[]) => {
      for (const event of events) {
        delivering = delivering.then(() =>
          Effect.runPromise(
            Effect.andThen(services.emit(event), services.record(event))
          )
        );
      }
    };

    const onNotification = (method: string, raw: unknown) => {
      if (method !== "session/update" || replaying) {
        return;
      }

      const { update } = raw as { update?: Record<string, unknown> };
      if (update === undefined) {
        return;
      }

      if (firstChunk && update.sessionUpdate === "agent_message_chunk") {
        firstChunk = false;
        const text =
          (update.content as { text?: string } | undefined)?.text ?? "";
        const inBand = config.inBand(text);
        if (inBand !== null) {
          Effect.runSync(Ref.set(failure, inBand));
          return;
        }
      }

      deliver(translator.take(update));
    };

    const onRequest = (method: string, raw: unknown) => {
      if (method === "session/request_permission") {
        return answerPermission(
          {
            cwd: services.cwd,
            emit: services.emit,
            gate: services.gate,
            turnId: services.turnId,
          },
          raw as never
        );
      }

      return Promise.reject(new Error(`the studio does not answer ${method}`));
    };

    const { fresh, held } = yield* Effect.acquireRelease(
      acpPool.checkout(
        params.historyId,
        {
          args: config.args,
          command: config.command,
          cwd: services.cwd,
          log: (line) => Effect.runSync(services.log(line)),
        },
        params.sessionId
      ),
      (checkout, exit) =>
        Effect.andThen(
          services.gate.abandon(services.turnId),
          Effect.flatMap(Ref.get(failure), (failed) =>
            giveBack(
              params.historyId,
              checkout.held,
              Exit.isSuccess(exit) && failed === null,
              opened.sessionId
            )
          )
        )
    );

    replaying = fresh && params.sessionId !== null;
    held.bind({ onNotification, onRequest });

    yield* Effect.tryPromise({
      catch: (cause) => new Error(errorMessage(cause)),
      try: () => run(held.peer),
    }).pipe(
      Effect.tap(() => Effect.promise(() => delivering)),
      Effect.catch((error) =>
        Ref.update(
          failure,
          (current) => current ?? config.classify(error.message)
        )
      )
    );

    return {
      context: null,
      failure: yield* Ref.get(failure),
      sessionId: opened.sessionId,
    } satisfies PromptResult;

    async function run(agent: AcpPeer): Promise<void> {
      const session: OpenedSession = fresh
        ? await open(agent)
        : { modes: held.modes };
      if (!fresh) {
        opened.sessionId = held.sessionId;
      }
      held.modes = session.modes;
      replaying = false;

      if (opened.sessionId === null) {
        throw new Error("The agent opened no session to speak in.");
      }

      deliver([
        {
          mode: params.mode,
          model: "",
          sessionId: opened.sessionId,
          type: "session",
        },
      ]);

      await enterMode(agent, opened.sessionId, session);

      if (!config.images && params.attachments.length > 0) {
        deliver([
          {
            message:
              "This provider cannot look at images, so the attached pictures were not sent.",
            type: "notice",
          },
        ]);
      }

      const answered = await agent.request<{ stopReason?: string }>(
        "session/prompt",
        { prompt: await promptOf(), sessionId: opened.sessionId }
      );

      if (answered.stopReason === "refusal") {
        throw new Error("The agent refused to answer this prompt.");
      }
    }

    async function promptOf(): Promise<AcpBlock[]> {
      const conventions = conventionsFor(
        config.knowledge.loaded,
        services.video
      );
      const briefed =
        services.briefs.pipeline === null
          ? conventions
          : `${conventions}\n\n${services.briefs.pipeline}`;
      const trailer =
        [services.briefs.assets, services.briefs.brand]
          .filter(Boolean)
          .join("\n\n") || null;

      const blocks = config.images
        ? await blocksOf(params, trailer, services.briefs.media)
        : textOnly(params, trailer, services.briefs.media);

      return [{ text: briefed, type: "text" }, ...blocks];
    }

    async function open(agent: AcpPeer): Promise<OpenedSession> {
      await agent.request("initialize", {
        clientCapabilities: {
          fs: { readTextFile: false, writeTextFile: false },
        },
        protocolVersion: 1,
      });

      const mcpServers = Object.entries(services.tools).map(
        ([name, transport]) => ({
          args: [...transport.args],
          command: transport.command,
          env: Object.entries(transport.env).map(([key, value]) => ({
            name: key,
            value,
          })),
          name,
        })
      );

      if (params.sessionId === null) {
        const session = await agent.request<OpenedSession>("session/new", {
          cwd: services.cwd,
          mcpServers,
        });
        opened.sessionId = session.sessionId ?? null;
        return session;
      }

      const session = await agent.request<OpenedSession>("session/load", {
        cwd: services.cwd,
        mcpServers,
        sessionId: params.sessionId,
      });
      opened.sessionId = params.sessionId;
      return session;
    }

    async function enterMode(
      agent: AcpPeer,
      sessionId: string,
      session: OpenedSession
    ): Promise<void> {
      const wanted = MODE_FRAGMENTS[params.mode];
      const available = session.modes?.availableModes ?? [];
      const found = available.find((candidate) =>
        (candidate.id ?? "").toLowerCase().includes(wanted)
      );

      if (
        found?.id === undefined ||
        found.id === session.modes?.currentModeId
      ) {
        return;
      }

      try {
        await agent.request("session/set_mode", {
          modeId: found.id,
          sessionId,
        });
        held.modes = { ...session.modes, currentModeId: found.id };
      } catch (cause) {
        Effect.runSync(
          services.log(`acp: could not enter ${params.mode}: ${String(cause)}`)
        );
      }
    }
  }).pipe(Effect.scoped);
}

function giveBack(
  chat: string,
  held: Held,
  clean: boolean,
  sessionId: string | null
): Effect.Effect<void> {
  if (clean && sessionId !== null) {
    held.sessionId = sessionId;
    return acpPool.checkin(chat, held);
  }
  return Effect.suspend(() => {
    if (sessionId !== null) {
      held.peer.notify("session/cancel", { sessionId });
    }
    return acpPool.discard(chat, held);
  });
}

function textOnly(
  params: PromptParams,
  ...appended: readonly (string | null)[]
): { text: string; type: "text" }[] {
  const blocks: { text: string; type: "text" }[] = [
    { text: params.prompt, type: "text" },
  ];

  for (const trailer of [elementsOf(params.elements), ...appended]) {
    if (trailer !== null) {
      blocks.push({ text: trailer, type: "text" });
    }
  }

  return blocks;
}
