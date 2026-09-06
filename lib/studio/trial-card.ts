import type { AccountPlan } from "@/shared/entitlement";

export type TrialCardKind = "grace" | "invite" | "trialEnded" | "unverified";

export interface TrialCard {
  id: string;
  kind: TrialCardKind;
  until: string | null;
}

export type TrialCardAccount =
  | { kind: "signedIn"; plan: AccountPlan | null }
  | { kind: "signedOut" }
  | { kind: "signingIn" }
  | { kind: "unknown" };

export const INVITE_CARD_ID = "invite";

export function trialCardOf(
  account: TrialCardAccount,
  dismissed: readonly string[]
): TrialCard | null {
  const card = candidateOf(account);
  if (card === null || dismissed.includes(card.id)) {
    return null;
  }
  return card;
}

function candidateOf(account: TrialCardAccount): TrialCard | null {
  switch (account.kind) {
    case "unknown":
      return null;
    case "signedOut":
    case "signingIn":
      return { id: INVITE_CARD_ID, kind: "invite", until: null };
    default:
      return signedInCard(account.plan);
  }
}

function signedInCard(plan: AccountPlan | null): TrialCard | null {
  if (plan === null) {
    return null;
  }
  if (plan.kind === "grace") {
    return {
      id: `grace:${plan.accessUntil}`,
      kind: "grace",
      until: plan.accessUntil,
    };
  }
  if (plan.kind === "free" && plan.unverified) {
    return { id: "unverified", kind: "unverified", until: null };
  }
  if (plan.kind === "free" && plan.trialEndedAt !== null) {
    return {
      id: `trial-ended:${plan.trialEndedAt}`,
      kind: "trialEnded",
      until: plan.trialEndedAt,
    };
  }
  return null;
}

export function isOnFree(account: TrialCardAccount): boolean {
  switch (account.kind) {
    case "signedOut":
    case "signingIn":
      return true;
    case "signedIn":
      return account.plan?.kind === "free";
    default:
      return false;
  }
}
