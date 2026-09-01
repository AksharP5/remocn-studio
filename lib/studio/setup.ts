import type { EnvironmentCheck } from "@/shared/ipc";
import {
  type AgentProvider,
  isAgentProvider,
  PROVIDER_STEPS,
  type ProviderStep,
} from "@/shared/providers";

export const SETUP_STAGES = [...PROVIDER_STEPS, "return"] as const;

export type SetupStage = (typeof SETUP_STAGES)[number];

export type StageState = "done" | "current" | "todo";

export function pendingStep(
  row: EnvironmentCheck | undefined
): ProviderStep | null {
  if (row === undefined || row.state !== "failed") {
    return null;
  }
  return row.fix?.type === "provider" ? row.fix.step : null;
}

export function stageStates(
  row: EnvironmentCheck | undefined
): Record<SetupStage, StageState> {
  if (row !== undefined && row.state === "ok") {
    return { install: "done", return: "done", signin: "done" };
  }

  const pending = pendingStep(row) ?? "install";
  const at = SETUP_STAGES.indexOf(pending);

  return {
    install: stateAt(0, at),
    return: stateAt(2, at),
    signin: stateAt(1, at),
  };
}

function stateAt(index: number, current: number): StageState {
  if (index < current) {
    return "done";
  }
  return index === current ? "current" : "todo";
}

export function providerStatus(
  row: EnvironmentCheck | undefined
): "Sign in" | "Not installed" | "Unavailable" | null {
  if (row === undefined || row.state !== "failed") {
    return null;
  }

  const step = pendingStep(row);
  if (step === "signin") {
    return "Sign in";
  }
  return step === "install" ? "Not installed" : "Unavailable";
}

export function failedProviders(
  checks: readonly EnvironmentCheck[]
): readonly AgentProvider[] {
  return checks.flatMap((check) =>
    check.state === "failed" && isAgentProvider(check.id) ? [check.id] : []
  );
}

export function shouldRecheck(
  lastAt: number | null,
  now: number,
  gapMs: number
): boolean {
  return lastAt === null || now - lastAt >= gapMs;
}
