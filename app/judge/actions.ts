"use server";

/**
 * Judge portal server actions: thin proxies to the backend's /api/judge.
 *
 * The browser signs in with Google (Firebase) and hands each action its ID
 * token; the action forwards it as `Authorization: Bearer …` and the backend
 * verifies it and decides who this is. Nothing here trusts a uid, name or
 * email from the client, and nothing here talks to a database.
 */

import { BackendError, backendRequest } from "@/lib/backend";

export type JudgeCriterionView = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  minScore: number;
  maxScore: number;
  displayOrder: number;
};

export type JudgeSessionView = {
  judgeId: string;
  judgeName: string;
  judgeEmail: string;
  assignmentId: string;
  eventId: string;
  eventName: string;
  startingBudget: number;
  criteria: JudgeCriterionView[];
  maxTotal: number;
};

/**
 * Where a signed-in person stands with the event. `unavailable` is not a
 * verdict about the person at all — the backend could not be reached or
 * failed — and the UI must show it as an outage with a retry, never as a
 * refusal.
 */
export type JudgeSessionResult =
  | { status: "signed_out"; message: string }
  | { status: "no_profile"; message: string }
  | { status: "pending"; message: string }
  | { status: "denied"; message: string }
  | { status: "unavailable"; message: string }
  | { status: "active"; message: string; session: JudgeSessionView };

export type JudgeReport = { status: "success" | "invalid" | "denied" | "error"; message: string };

export type JudgeTeamOption = {
  id: number;
  name: string;
  code: string;
  leaderName: string;
  memberNames: string[];
  /** This judge's total for the team, once scored. */
  reviewedScore: number | null;
};

export type JudgeSearchResult = { status: "success" | "error"; message: string; teams: JudgeTeamOption[] };

export type JudgeResourceItem = {
  roundOrder: number;
  roundName: string;
  tierName: string;
  pricePaid: number;
  priceSource: string;
};

export type JudgeResources = { startingBudget: number; spent: number; remaining: number; items: JudgeResourceItem[] };

export type JudgeEvaluationView = {
  id: string;
  status: "DRAFT" | "SUBMITTED";
  review: string | null;
  scores: Array<{ criterionId: string; key: string; score: number }>;
  total: number;
  submittedAt: string | null;
  updatedAt: string;
};

export type JudgeReviewContext = {
  team: { id: number; name: string; code: string; members: Array<{ name: string; email: string; isLeader: boolean }> };
  resources: JudgeResources;
  evaluation: JudgeEvaluationView | null;
};

export type JudgeReviewResult =
  | { status: "success"; message: string; context: JudgeReviewContext }
  | { status: "error"; message: string; context: null };

export type JudgeSubmitReport = {
  status: "success" | "invalid" | "error";
  message: string;
  evaluation: JudgeEvaluationView | null;
};

export type JudgeResultsView = {
  status: "success" | "error";
  message?: string;
  eventName: string;
  criteria: JudgeCriterionView[];
  maxTotal: number;
  teams: Array<{
    id: number;
    name: string;
    code: string;
    average: number;
    evaluations: Array<{
      id: string;
      judgeName: string;
      review: string | null;
      total: number;
      scores: Array<{ criterionId: string; score: number }>;
      submittedAt: string | null;
    }>;
  }>;
};

function bearer(idToken: string | null): Record<string, string> {
  return idToken ? { Authorization: `Bearer ${idToken}` } : {};
}

function unreachable(error: unknown) {
  console.error("judge action failed:", error);
  if (error instanceof BackendError && error.status === 0) {
    return "Could not reach the backend — it may not be running, or NEXT_PUBLIC_BACKEND_URL is wrong.";
  }
  if (error instanceof BackendError && error.status === 503) {
    return "The backend is not configured for judge sign-in (FIREBASE_PROJECT_ID).";
  }
  return "The backend could not complete that request.";
}

export async function getJudgeSessionAction(idToken: string | null): Promise<JudgeSessionResult> {
  if (!idToken) return { status: "signed_out", message: "Sign in with Google first." };
  try {
    return await backendRequest<JudgeSessionResult>("/api/judge/session", { headers: bearer(idToken) });
  } catch (error) {
    return { status: "unavailable", message: unreachable(error) };
  }
}

export async function applyAsJudgeAction(idToken: string | null, code: string): Promise<JudgeReport> {
  if (!idToken) return { status: "invalid", message: "Sign in with Google first." };
  try {
    return await backendRequest<JudgeReport>("/api/judge/apply", { body: { code }, headers: bearer(idToken) });
  } catch (error) {
    return { status: "error", message: unreachable(error) };
  }
}

export async function searchJudgeTeamsAction(idToken: string | null, query: string): Promise<JudgeSearchResult> {
  if (!idToken) return { status: "error", message: "Sign in to browse teams.", teams: [] };
  try {
    return await backendRequest<JudgeSearchResult>(`/api/judge/teams?q=${encodeURIComponent(query)}`, {
      headers: bearer(idToken),
    });
  } catch (error) {
    return { status: "error", message: unreachable(error), teams: [] };
  }
}

export async function getJudgeReviewAction(idToken: string | null, teamId: number): Promise<JudgeReviewResult> {
  if (!idToken) return { status: "error", message: "Sign in to review a team.", context: null };
  try {
    return await backendRequest<JudgeReviewResult>(`/api/judge/teams/${teamId}/review`, { headers: bearer(idToken) });
  } catch (error) {
    return { status: "error", message: unreachable(error), context: null };
  }
}

export async function submitJudgeEvaluationAction(
  idToken: string | null,
  teamId: number,
  payload: { review: string; scores: Record<string, number> },
): Promise<JudgeSubmitReport> {
  if (!idToken) return { status: "invalid", message: "Your sign-in has expired. Sign in again and resubmit.", evaluation: null };
  try {
    return await backendRequest<JudgeSubmitReport>(`/api/judge/teams/${teamId}/evaluation`, {
      method: "PUT",
      body: payload,
      headers: bearer(idToken),
    });
  } catch (error) {
    return { status: "error", message: unreachable(error), evaluation: null };
  }
}

/** The popup before /judge/evaluations: name + invitation code. */
export async function verifyResultsAccessAction(
  idToken: string | null,
  payload: { name: string; code: string },
): Promise<JudgeReport> {
  if (!idToken) return { status: "denied", message: "Sign in with Google first." };
  try {
    return await backendRequest<JudgeReport>("/api/judge/results-access", { body: payload, headers: bearer(idToken) });
  } catch (error) {
    return { status: "error", message: unreachable(error) };
  }
}

export async function getJudgeResultsAction(idToken: string | null, resultsKey: string): Promise<JudgeResultsView> {
  const empty = { eventName: "HackGrid", criteria: [], maxTotal: 0, teams: [] };
  if (!idToken || !resultsKey) {
    return { status: "error", message: "Verify yourself from the judge portal first.", ...empty };
  }
  try {
    return await backendRequest<JudgeResultsView>("/api/judge/results", {
      headers: { ...bearer(idToken), "x-judge-results-key": resultsKey },
    });
  } catch (error) {
    return { status: "error", message: unreachable(error), ...empty };
  }
}
