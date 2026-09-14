import type { Connection } from "@/shared/integrations";

export interface ConnectionCalls {
  readonly usable: () => Promise<readonly Connection[]>;
}

export const NONE_CONNECTED =
  "No service is connected. The person can connect one in Settings under Integrations.";

function described(connection: Connection): string {
  const account = connection.account === null ? "" : ` (${connection.account})`;
  const can =
    connection.capabilities.length === 0
      ? "nothing yet"
      : connection.capabilities.join(", ");

  return `- [${connection.id}] ${connection.provider} — “${connection.name}”${account}: ${can}`;
}

export async function listConnections(calls: ConnectionCalls): Promise<string> {
  const usable = await calls.usable();

  if (usable.length === 0) {
    return NONE_CONNECTED;
  }

  return [
    "These services are connected and ready to use:",
    ...usable.map(described),
  ].join("\n");
}
