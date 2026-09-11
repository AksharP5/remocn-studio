"use client";

import { PlugZapIcon, PlusIcon } from "lucide-react";
import type { FormEvent, MouseEvent } from "react";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useIntegrations } from "@/hooks/use-integrations";
import type {
  AuthorizationKind,
  Connection,
  ConnectionState,
  IntegrationProvider,
} from "@/shared/integrations";
import { SettingsPanel as Group } from "./settings-group";

const STATE_LABELS = {
  checking: "Checking",
  connected: "Connected",
  "needs-authorization": "Action needed",
  unavailable: "Unavailable",
} satisfies Record<ConnectionState, string>;

const STATE_VARIANTS = {
  checking: "outline",
  connected: "success",
  "needs-authorization": "error",
  unavailable: "warning",
} satisfies Record<
  ConnectionState,
  "error" | "outline" | "success" | "warning"
>;

const SECRET_LABELS = {
  "api-key": "API key",
  browser: "Sign in",
  "personal-token": "Personal access token",
} satisfies Record<AuthorizationKind, string>;

export function IntegrationsSection() {
  const integrations = useIntegrations();

  return (
    <Group
      action={
        integrations.step === "closed" && integrations.catalogue.length > 0 ? (
          <Button onClick={integrations.onOpenAdd} size="sm" variant="outline">
            <PlusIcon data-icon="inline-start" />
            Add integration
          </Button>
        ) : null
      }
      description="Services the studio can reach with your own account. Each key stays in this Mac’s keychain and never reaches a chat, a model or your project."
      title="Services"
    >
      {integrations.step === "closed" ? null : (
        <AddFlow integrations={integrations} />
      )}

      {integrations.connections.length === 0 &&
      integrations.step === "closed" ? (
        <Empty hasCatalogue={integrations.catalogue.length > 0} />
      ) : null}

      {integrations.connections.length > 0 ? (
        <div className="flex flex-col divide-y divide-border/60">
          {integrations.connections.map((connection) => (
            <ConnectionRow
              busy={integrations.busy === connection.id}
              connection={connection}
              key={connection.id}
              onCheck={integrations.onCheck}
              onRemove={integrations.onRemove}
              onToggleDisabled={integrations.onToggleDisabled}
            />
          ))}
        </div>
      ) : null}

      {integrations.notice === null ? null : (
        <p className="break-words text-muted-foreground text-xs">
          {integrations.notice}
        </p>
      )}

      {integrations.error === null ? null : (
        <p className="break-words text-destructive text-xs" role="alert">
          {integrations.error}
        </p>
      )}
    </Group>
  );
}

function Empty({ hasCatalogue }: { hasCatalogue: boolean }) {
  return (
    <div className="flex flex-col items-start gap-1 rounded-md border border-border/60 border-dashed px-3 py-4">
      <p className="flex items-center gap-2 font-medium text-sm">
        <PlugZapIcon className="size-4 text-muted-foreground" />
        Nothing is connected yet
      </p>
      <p className="text-muted-foreground text-xs">
        {hasCatalogue
          ? "Add one and the agent can use it while it works on a video."
          : "This build carries no service the studio can connect to."}
      </p>
    </div>
  );
}

function AddFlow({
  integrations,
}: {
  integrations: ReturnType<typeof useIntegrations>;
}) {
  const { candidate, step } = integrations;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border/60 px-3 py-3">
      {step === "picking" ? (
        <Picking
          catalogue={integrations.catalogue}
          onChoose={integrations.onChoose}
        />
      ) : null}

      {step === "chosen" && candidate !== null ? (
        <Authorizing
          busy={integrations.busy === "checking"}
          onSubmit={integrations.onSubmitSecret}
          provider={candidate}
        />
      ) : null}

      {step === "naming" && candidate !== null ? (
        <Naming
          account={integrations.attempt?.account ?? null}
          busy={integrations.busy === "saving"}
          onConfirm={integrations.onConfirm}
          provider={candidate}
        />
      ) : null}

      <Button
        className="self-start"
        onClick={integrations.onCancelAdd}
        size="sm"
        variant="ghost"
      >
        Cancel
      </Button>
    </div>
  );
}

function Picking({
  catalogue,
  onChoose,
}: {
  catalogue: readonly IntegrationProvider[];
  onChoose: (provider: IntegrationProvider) => void;
}) {
  const onPick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const picked = catalogue.find(
        (one) => one.id === event.currentTarget.value
      );
      if (picked !== undefined) {
        onChoose(picked);
      }
    },
    [catalogue, onChoose]
  );

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-2 font-medium text-sm">Choose a service</legend>
      {catalogue.map((provider) => (
        <button
          className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-left text-sm outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/50"
          key={provider.id}
          onClick={onPick}
          type="button"
          value={provider.id}
        >
          <span className="font-medium">{provider.name}</span>
          <span className="text-muted-foreground text-xs">
            {provider.capabilities.join(", ")}
          </span>
        </button>
      ))}
    </fieldset>
  );
}

function Authorizing({
  busy,
  onSubmit,
  provider,
}: {
  busy: boolean;
  onSubmit: (secret: string) => void;
  provider: IntegrationProvider;
}) {
  const [secret, setSecret] = useState("");
  const label = SECRET_LABELS[provider.authorization[0]];

  const onChange = useCallback((event: FormEvent<HTMLInputElement>) => {
    setSecret(event.currentTarget.value);
  }, []);

  const onCheck = useCallback(() => {
    onSubmit(secret);
  }, [onSubmit, secret]);

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm" htmlFor="integration-secret">
        {label} for {provider.name}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          autoComplete="off"
          className="flex-1"
          id="integration-secret"
          onChange={onChange}
          placeholder={`Paste your ${label.toLowerCase()}`}
          type="password"
          value={secret}
        />
        <Button
          disabled={busy || secret.trim().length === 0}
          onClick={onCheck}
          size="sm"
          variant="outline"
        >
          {busy ? (
            <Spinner className="size-3.5" data-icon="inline-start" />
          ) : null}
          Check
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        The studio checks it with {provider.name} before keeping it.
      </p>
    </div>
  );
}

function Naming({
  account,
  busy,
  onConfirm,
  provider,
}: {
  account: string | null;
  busy: boolean;
  onConfirm: (name: string) => void;
  provider: IntegrationProvider;
}) {
  const [name, setName] = useState("");

  const onChange = useCallback((event: FormEvent<HTMLInputElement>) => {
    setName(event.currentTarget.value);
  }, []);

  const onSave = useCallback(() => {
    onConfirm(name);
  }, [name, onConfirm]);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        {provider.name} accepted it
        {account === null ? "" : ` as ${account}`}.
      </p>
      <Label className="text-sm" htmlFor="integration-name">
        Name this connection
      </Label>
      <div className="flex items-center gap-2">
        <Input
          className="flex-1"
          id="integration-name"
          onChange={onChange}
          placeholder="Work, Personal, a client’s name…"
          value={name}
        />
        <Button
          disabled={busy || name.trim().length === 0}
          onClick={onSave}
          size="sm"
          variant="outline"
        >
          {busy ? (
            <Spinner className="size-3.5" data-icon="inline-start" />
          ) : null}
          Save
        </Button>
      </div>
    </div>
  );
}

function ConnectionRow({
  busy,
  connection,
  onCheck,
  onRemove,
  onToggleDisabled,
}: {
  busy: boolean;
  connection: Connection;
  onCheck: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleDisabled: (id: string, disabled: boolean) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  const onRecheck = useCallback(() => {
    onCheck(connection.id);
  }, [connection.id, onCheck]);

  const onFlip = useCallback(() => {
    onToggleDisabled(connection.id, !connection.disabled);
  }, [connection.disabled, connection.id, onToggleDisabled]);

  const onAskRemove = useCallback(() => {
    setConfirming(true);
  }, []);

  const onKeepIt = useCallback(() => {
    setConfirming(false);
  }, []);

  const onReallyRemove = useCallback(() => {
    setConfirming(false);
    onRemove(connection.id);
  }, [connection.id, onRemove]);

  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-medium text-sm">
            {connection.name}
            <span className="font-normal text-muted-foreground text-xs">
              {connection.provider}
            </span>
          </p>
          <p className="truncate text-muted-foreground text-xs">
            {connection.account ?? "Account not known yet"}
            {connection.capabilities.length > 0
              ? ` · ${connection.capabilities.join(", ")}`
              : ""}
          </p>
          {connection.detail === null ? null : (
            <p className="break-words pt-1 text-muted-foreground text-xs">
              {connection.detail}
            </p>
          )}
        </div>

        <Badge
          variant={
            connection.disabled ? "outline" : STATE_VARIANTS[connection.state]
          }
        >
          {connection.disabled ? "Off" : STATE_LABELS[connection.state]}
        </Badge>
      </div>

      {confirming ? (
        <div className="flex flex-col gap-2 rounded-md border border-destructive/40 px-3 py-2">
          <p className="text-xs">
            Remove “{connection.name}”? Its key is deleted from this Mac’s
            keychain and the studio stops using it.
          </p>
          <div className="flex items-center gap-2">
            <Button onClick={onReallyRemove} size="sm" variant="destructive">
              Remove
            </Button>
            <Button onClick={onKeepIt} size="sm" variant="ghost">
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            disabled={busy}
            onClick={onRecheck}
            size="sm"
            variant="outline"
          >
            {busy ? (
              <Spinner className="size-3.5" data-icon="inline-start" />
            ) : null}
            Check
          </Button>
          <Button disabled={busy} onClick={onFlip} size="sm" variant="ghost">
            {connection.disabled ? "Enable" : "Disable"}
          </Button>
          <Button
            disabled={busy}
            onClick={onAskRemove}
            size="sm"
            variant="ghost"
          >
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
