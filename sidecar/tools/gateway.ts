import { randomBytes } from "node:crypto";
import { unlinkSync } from "node:fs";
import { createServer, type Server, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { Effect, Exit, type Scope } from "effect";
import { errorMessage } from "@/lib/error-message";
import { TOOLS_HOST_FLAG } from "../flags";
import { type Ask, executeTool, type TurnTools } from "./execute";
import {
  decodeToolCall,
  TOOLS_SOCKET_ENV,
  TOOLS_TURN_ENV,
  type ToolReply,
} from "./protocol";
import { isToolServer, type ToolServer } from "./specs";

export interface StdioTransport {
  readonly args: readonly string[];
  readonly command: string;
  readonly env: Readonly<Record<string, string>>;
}

export interface ToolGateway {
  readonly ask: (server: ToolServer, turnId: string) => Ask;
  readonly serving: (
    turnId: string,
    tools: TurnTools
  ) => Effect.Effect<void, never, Scope.Scope>;
  readonly transport: (server: ToolServer, turnId: string) => StdioTransport;
}

export function makeGateway(
  log: (line: string) => void = () => undefined,
  socketPath: string = join(
    tmpdir(),
    `remocn-tools-${process.pid}-${randomBytes(4).toString("hex")}.sock`
  )
): ToolGateway {
  const turns = new Map<string, TurnTools>();
  const active = new Map<string, Set<AbortController>>();

  let listening: Promise<Server> | null = null;

  const listen = (): Promise<Server> => {
    listening ??= new Promise((ready, failed) => {
      const server = createServer((socket) => serve(socket));
      server.once("error", failed);
      server.listen(socketPath, () => {
        server.removeListener("error", failed);
        process.once("exit", () => removeSocket(socketPath));
        ready(server);
      });
    });
    return listening;
  };

  const serve = (socket: Socket) => {
    const lines = createInterface({ input: socket });
    const executions = new Map<string, AbortController>();
    socket.on("close", () => {
      for (const controller of executions.values()) {
        controller.abort();
      }
      executions.clear();
    });

    const reply = (frame: ToolReply) => {
      socket.write(`${JSON.stringify(frame)}\n`);
    };

    lines.on("line", (line) => {
      if (line.trim().length === 0) {
        return;
      }

      const call = decodeToolCall(line);
      if (Exit.isFailure(call)) {
        log(`tools: dropped a frame it could not parse: ${line}`);
        return;
      }

      const { id, params, server, tool, turn } = call.value;
      if (call.value.cancel) {
        executions.get(id)?.abort();
        return;
      }
      const refused = (text: string) =>
        reply({ id, isError: true, text, type: "reply" });

      const tools = turns.get(turn);
      if (tools === undefined) {
        refused(
          "This turn is no longer running, so the studio cannot answer its tools."
        );
        return;
      }
      if (!isToolServer(server)) {
        refused(`There is no tool server called ${server}.`);
        return;
      }

      const controller = new AbortController();
      executions.set(id, controller);
      active.get(turn)?.add(controller);
      executeTool(server, tool, params, tools, {
        progress: (stage, completed, total) =>
          reply({
            id,
            isError: false,
            progress: { completed, total },
            text: stage,
            type: "progress",
          }),
        signal: controller.signal,
      })
        .then((answer) => {
          executions.delete(id);
          active.get(turn)?.delete(controller);
          log(`tools: ${server}.${tool} ${answer.isError ? "failed" : "ok"}`);
          reply({
            id,
            isError: answer.isError,
            text: answer.text,
            type: "reply",
          });
        })
        .catch((cause) => refused(errorMessage(cause)));
    });

    socket.on("error", () => undefined);
  };

  return {
    ask: (server, turnId) => (tool, params, execution) => {
      const tools = turns.get(turnId);
      if (tools === undefined) {
        return Promise.resolve({
          isError: true,
          text: "This turn is no longer running, so the studio cannot answer its tools.",
        });
      }

      const controller = new AbortController();
      const abort = () => controller.abort();
      execution?.signal?.addEventListener("abort", abort, { once: true });
      if (execution?.signal?.aborted) {
        abort();
      }
      active.get(turnId)?.add(controller);

      return executeTool(server, tool, params, tools, {
        ...(execution?.progress === undefined
          ? {}
          : { progress: execution.progress }),
        signal: controller.signal,
      })
        .catch((cause) => ({ isError: true, text: errorMessage(cause) }))
        .then((answer) => {
          log(`tools: ${server}.${tool} ${answer.isError ? "failed" : "ok"}`);
          return answer;
        })
        .finally(() => {
          active.get(turnId)?.delete(controller);
          execution?.signal?.removeEventListener("abort", abort);
        });
    },

    // A gateway that cannot listen is logged, not fatal: the children then
    // fail to connect and the CLI reports the servers down, while the turn —
    // whose words matter more than its tools — still runs.
    serving: (turnId, tools) => {
      const running = new Set<AbortController>();
      return Effect.acquireRelease(
        Effect.promise(async () => {
          try {
            await listen();
          } catch (cause) {
            log(`tools: the gateway could not listen: ${errorMessage(cause)}`);
          }
          turns.set(turnId, tools);
          active.set(turnId, running);
        }),
        () =>
          Effect.sync(() => {
            if (turns.get(turnId) === tools) {
              turns.delete(turnId);
            }
            if (active.get(turnId) === running) {
              active.delete(turnId);
            }
            for (const controller of running) {
              controller.abort();
            }
          })
      ).pipe(Effect.asVoid);
    },

    transport: (server, turnId) => ({
      args: [process.argv[1] ?? "", TOOLS_HOST_FLAG, server],
      command: process.execPath,
      env: {
        [TOOLS_SOCKET_ENV]: socketPath,
        [TOOLS_TURN_ENV]: turnId,
      },
    }),
  };
}

function removeSocket(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    // a socket that was never created leaves nothing to remove
  }
}
