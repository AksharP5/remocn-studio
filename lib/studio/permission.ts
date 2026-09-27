import type {
  PermissionDecision,
  PermissionReason,
  SessionMode,
} from "@/shared/ipc";
import type { PendingPermission } from "./turns";

export type PermissionAction = PermissionDecision | "cancel";

export interface PermissionChoice {
  action: PermissionAction;
  description: string;
  disabled?: boolean;
  id: string;
  label: string;
  mode: SessionMode | null;
}

const TITLES: Record<PermissionReason, string> = {
  bash: "Approve this command?",
  outside: "Approve this path outside the project?",
  outward: "Send this to a connected service?",
  plan: "Ready to build this plan?",
  tool: "Approve this tool call?",
};

const AGAIN: Record<Exclude<PermissionReason, "outward" | "plan">, string> = {
  bash: "Don’t ask again for this command until the studio quits",
  outside: "Don’t ask again for this path until the studio quits",
  tool: "Don’t ask again for this call until the studio quits",
};

const OUTWARD_CHOICES: PermissionChoice[] = [
  {
    action: "allow",
    description: "Send it once; the studio asks again next time",
    id: "allow",
    label: "Send",
    mode: null,
  },
  {
    action: "deny",
    description: "Send nothing and let the agent continue",
    id: "deny",
    label: "Decline",
    mode: null,
  },
  {
    action: "cancel",
    description: "Send nothing and stop the turn",
    id: "cancel",
    label: "Cancel turn",
    mode: null,
  },
];

const PLAN_CHOICES: PermissionChoice[] = [
  {
    action: "allow",
    description: "Edits go through, commands still ask",
    id: "build",
    label: "Approve and build",
    mode: "acceptEdits",
  },
  {
    action: "allow",
    description: "The agent decides what is worth asking about",
    id: "run",
    label: "Approve and let it run",
    mode: "auto",
  },
  {
    action: "deny",
    description: "Send it back and say what to change",
    id: "keep",
    label: "Keep planning",
    mode: null,
  },
  {
    action: "cancel",
    description: "Stop the current turn",
    id: "cancel",
    label: "Cancel turn",
    mode: null,
  },
];

export function permissionTitle(reason: PermissionReason): string {
  return TITLES[reason];
}

export function planText(input: unknown): string | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const { plan } = input as Record<string, unknown>;
  return typeof plan === "string" && plan.length > 0 ? plan : null;
}

export function permissionChoices(
  reason: PermissionReason
): PermissionChoice[] {
  if (reason === "plan") {
    return PLAN_CHOICES;
  }

  if (reason === "outward") {
    return OUTWARD_CHOICES;
  }

  return [
    {
      action: "allow",
      description: "Allow just this request",
      id: "allow",
      label: "Approve once",
      mode: null,
    },
    {
      action: "always",
      description:
        AGAIN[reason as Exclude<PermissionReason, "outward" | "plan">],
      id: "always",
      label: "Always allow until quit",
      mode: null,
    },
    {
      action: "deny",
      description: "Reject and let the agent continue",
      id: "deny",
      label: "Decline",
      mode: null,
    },
    {
      action: "cancel",
      description: "Stop the current turn",
      id: "cancel",
      label: "Cancel turn",
      mode: null,
    },
  ];
}

type Gathered = Exclude<PermissionReason, "plan">;

const BATCH_TITLES: Record<Gathered, (count: number) => string> = {
  bash: (count) => `Approve these ${count} commands?`,
  outside: (count) => `Approve these ${count} paths outside the project?`,
  outward: (count) => `Send these ${count} requests to a connected service?`,
  tool: (count) => `Approve these ${count} tool calls?`,
};

const BATCH_AGAIN: Record<Exclude<Gathered, "outward">, string> = {
  bash: "Don’t ask again for the checked commands until the studio quits; the rest are declined",
  outside:
    "Don’t ask again for the checked paths until the studio quits; the rest are declined",
  tool: "Don’t ask again for the checked calls until the studio quits; the rest are declined",
};

export function gatheredAsks(
  pending: readonly PendingPermission[]
): readonly PendingPermission[] {
  const [oldest] = pending;
  if (oldest === undefined) {
    return [];
  }
  if (oldest.reason === "plan") {
    return [oldest];
  }
  return pending.filter((ask) => ask.reason === oldest.reason);
}

export function batchTitle(reason: PermissionReason, count: number): string {
  return reason === "plan" ? TITLES.plan : BATCH_TITLES[reason](count);
}

function counted(verb: string, checked: number, total: number): string {
  return checked === total
    ? `${verb} all ${total}`
    : `${verb} ${checked} of ${total}`;
}

export function batchChoices(
  reason: PermissionReason,
  checked: number,
  total: number
): PermissionChoice[] {
  if (reason === "plan") {
    return PLAN_CHOICES;
  }

  const none = checked === 0;
  const outward = reason === "outward";
  const approve: PermissionChoice = {
    action: "allow",
    description: outward
      ? "Send each checked request once; the rest are declined"
      : "Allow each checked call once; the rest are declined",
    disabled: none,
    id: "allow",
    label: counted(outward ? "Send" : "Approve", checked, total),
    mode: null,
  };
  const decline: PermissionChoice = {
    action: "deny",
    description: outward
      ? "Send nothing and let the agent continue"
      : "Reject every call and let the agent continue",
    id: "deny",
    label: "Decline all",
    mode: null,
  };
  const cancel: PermissionChoice = {
    action: "cancel",
    description: outward
      ? "Send nothing and stop the turn"
      : "Stop the current turn",
    id: "cancel",
    label: "Cancel turn",
    mode: null,
  };

  if (outward) {
    return [approve, decline, cancel];
  }

  return [
    approve,
    {
      action: "always",
      description: BATCH_AGAIN[reason],
      disabled: none,
      id: "always",
      label: `${counted("Always allow", checked, total)} until quit`,
      mode: null,
    },
    decline,
    cancel,
  ];
}
