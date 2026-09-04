import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { modelLabelOf, offersAutoMode } from "@/lib/studio/models";
import {
  type AgentEvent,
  isSessionMode,
  SESSION_MODE_LABELS,
  type SessionMode,
} from "@/shared/ipc";
import { verbOf } from "./vocabulary";

export function eventsOf(
  message: SDKMessage,
  requested: SessionMode
): AgentEvent[] {
  if (message.type === "system") {
    if (message.subtype === "init") {
      return sessionEvents(
        { model: message.model, sessionId: message.session_id },
        message.permissionMode,
        requested
      );
    }

    if (message.subtype === "permission_denied") {
      return [
        {
          message: `Claude Code declined ${message.tool_name} without asking. ${message.decision_reason ?? message.message}`,
          type: "notice",
        },
      ];
    }

    return [];
  }

  if (message.type === "stream_event") {
    return deltaEvents(message.event);
  }

  if (message.type === "assistant") {
    return toolUses(message.message.content);
  }

  if (message.type === "user") {
    return toolResults(message.message.content);
  }

  return [];
}

function sessionEvents(
  opened: { model: string; sessionId: string },
  effective: string,
  requested: SessionMode
): AgentEvent[] {
  const session: AgentEvent = {
    ...opened,
    mode: isSessionMode(effective) ? effective : null,
    type: "session",
  };

  if (effective === requested) {
    return [session];
  }

  return [
    session,
    { message: mismatch(opened.model, effective, requested), type: "notice" },
  ];
}

// "ran in default mode, not Auto" is true and reads as a fault in the studio.
// The commonest cause is the model — Claude Code takes `auto` from a model that
// cannot run it and downgrades in silence — so where that is what happened, the
// notice names it. Any other mismatch keeps the plain sentence rather than
// asserting a cause nothing measured.
function mismatch(
  model: string,
  effective: string,
  requested: SessionMode
): string {
  const ran = `Claude Code ran this turn in ${labelOf(effective)} mode`;

  if (requested !== "auto" || offersAutoMode(model)) {
    return `${ran}, not ${SESSION_MODE_LABELS[requested]}.`;
  }

  return `${modelLabelOf("claude", model)} does not offer ${SESSION_MODE_LABELS.auto}, so ${ran} instead.`;
}

function labelOf(mode: string): string {
  return isSessionMode(mode) ? SESSION_MODE_LABELS[mode] : mode;
}

function deltaEvents(event: { delta?: unknown; type: string }): AgentEvent[] {
  if (event.type !== "content_block_delta") {
    return [];
  }

  const delta = event.delta as
    | { text?: string; thinking?: string; type?: string }
    | undefined;

  if (delta?.type === "text_delta" && typeof delta.text === "string") {
    return [{ text: delta.text, type: "text" }];
  }
  if (delta?.type === "thinking_delta" && typeof delta.thinking === "string") {
    return [{ text: delta.thinking, type: "thinking" }];
  }
  return [];
}

function toolUses(content: unknown): AgentEvent[] {
  return blocks(content).flatMap((block) =>
    block.type === "tool_use" &&
    typeof block.id === "string" &&
    typeof block.name === "string"
      ? [
          {
            id: block.id,
            input: block.input,
            name: block.name,
            type: "tool_use",
            verb: verbOf(block.name),
          },
        ]
      : []
  );
}

function toolResults(content: unknown): AgentEvent[] {
  return blocks(content).flatMap((block) =>
    block.type === "tool_result" && typeof block.tool_use_id === "string"
      ? [
          {
            id: block.tool_use_id,
            isError: block.is_error === true,
            text: flatten(block.content),
            type: "tool_result",
          },
        ]
      : []
  );
}

interface Block {
  content?: unknown;
  id?: unknown;
  input?: unknown;
  is_error?: unknown;
  name?: unknown;
  text?: unknown;
  tool_use_id?: unknown;
  type?: unknown;
}

function blocks(content: unknown): Block[] {
  return Array.isArray(content) ? (content as Block[]) : [];
}

export function flatten(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  return blocks(content)
    .flatMap((block) => (typeof block.text === "string" ? [block.text] : []))
    .join("\n");
}
