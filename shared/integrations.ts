import { Schema } from "effect";

export const INTEGRATION_CAPABILITIES = [
  "audio",
  "design",
  "import",
  "publish",
] as const;

export const IntegrationCapability = Schema.Literals(INTEGRATION_CAPABILITIES);

export type IntegrationCapability = (typeof IntegrationCapability)["Type"];

export const AUTHORIZATION_KINDS = [
  "api-key",
  "browser",
  "personal-token",
] as const;

export const AuthorizationKind = Schema.Literals(AUTHORIZATION_KINDS);

export type AuthorizationKind = (typeof AuthorizationKind)["Type"];

export const CONNECTION_STATES = [
  "checking",
  "connected",
  "needs-authorization",
  "unavailable",
] as const;

export const ConnectionState = Schema.Literals(CONNECTION_STATES);

export type ConnectionState = (typeof ConnectionState)["Type"];

export const IntegrationProvider = Schema.Struct({
  authorization: Schema.NonEmptyArray(AuthorizationKind),
  capabilities: Schema.NonEmptyArray(IntegrationCapability),
  id: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
});

export type IntegrationProvider = (typeof IntegrationProvider)["Type"];

export const Connection = Schema.Struct({
  account: Schema.NullOr(Schema.String),
  capabilities: Schema.Array(IntegrationCapability),
  detail: Schema.NullOr(Schema.String),
  disabled: Schema.Boolean,
  id: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  provider: Schema.NonEmptyString,
  state: ConnectionState,
});

export type Connection = (typeof Connection)["Type"];

export function isIntegrationCapability(
  value: unknown
): value is IntegrationCapability {
  return (
    typeof value === "string" &&
    (INTEGRATION_CAPABILITIES as readonly string[]).includes(value)
  );
}

export function isConnectionState(value: unknown): value is ConnectionState {
  return (
    typeof value === "string" &&
    (CONNECTION_STATES as readonly string[]).includes(value)
  );
}

export function isUsable(connection: Connection): boolean {
  return connection.state === "connected" && !connection.disabled;
}

export function hasCapability(
  connection: Connection,
  capability: IntegrationCapability
): boolean {
  return isUsable(connection) && connection.capabilities.includes(capability);
}

export const Catalogue = Schema.Array(IntegrationProvider);

export type Catalogue = (typeof Catalogue)["Type"];

export const Connections = Schema.Array(Connection);

export type Connections = (typeof Connections)["Type"];

export const ConnectionDraft = Schema.Struct({
  authorization: AuthorizationKind,
  provider: Schema.NonEmptyString,
  secret: Schema.NullOr(Schema.NonEmptyString),
});

export type ConnectionDraft = (typeof ConnectionDraft)["Type"];

export const ConnectionAttempt = Schema.Struct({
  account: Schema.NullOr(Schema.String),
  capabilities: Schema.Array(IntegrationCapability),
  provider: Schema.NonEmptyString,
});

export type ConnectionAttempt = (typeof ConnectionAttempt)["Type"];

export const ConnectionNaming = Schema.Struct({
  name: Schema.NonEmptyString,
});

export type ConnectionNaming = (typeof ConnectionNaming)["Type"];

export const ConnectionRef = Schema.Struct({
  id: Schema.NonEmptyString,
});

export type ConnectionRef = (typeof ConnectionRef)["Type"];

export const ConnectionSecretChange = Schema.Struct({
  id: Schema.NonEmptyString,
  secret: Schema.NonEmptyString,
});

export type ConnectionSecretChange = (typeof ConnectionSecretChange)["Type"];

export const ConnectionDisabling = Schema.Struct({
  disabled: Schema.Boolean,
  id: Schema.NonEmptyString,
});

export type ConnectionDisabling = (typeof ConnectionDisabling)["Type"];

export const ConnectionRemoval = Schema.Struct({
  detail: Schema.NullOr(Schema.String),
  withdrawn: Schema.Boolean,
});

export type ConnectionRemoval = (typeof ConnectionRemoval)["Type"];
