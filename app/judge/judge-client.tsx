"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase";
import { Chip, Eyebrow, ghostButton } from "@/components/ui/panel";
import {
  applyAsJudgeAction,
  getJudgeReviewAction,
  getJudgeSessionAction,
  searchJudgeTeamsAction,
  submitJudgeEvaluationAction,
  type JudgeEvaluationView,
  type JudgeReviewContext,
  type JudgeSearchResult,
  type JudgeSessionResult,
  type JudgeSessionView,
  type JudgeSubmitReport,
} from "./actions";
import { EvaluationForm } from "./evaluation-form";
import { JudgeEntrance, type EntranceView } from "./judge-entrance";
import { idTokenFor, writeResultsKey } from "./judge-session";
import { ResultsAccessDialog } from "./results-access-dialog";
import { SubmitBar } from "./submit-bar";
import { AuctionResources, TeamOverview } from "./team-overview";
import { TeamSearch } from "./team-search";

const emptySearch: JudgeSearchResult = { status: "success", message: "", teams: [] };

/**
 * The judge portal. Sign in with Google, apply with the invitation code,
 * and — once an organiser approves — search a team, read what it acquired,
 * score it against the rubric and submit. The backend owns every decision;
 * this component only mirrors what it answers.
 *
 * Judges sign in for real: the dev-only "act as" picker has no Firebase
 * session and so no ID token, and the backend verifies tokens, not emails.
 */
export function JudgeClient() {
  const { user, loading: authLoading, signOut } = useAuth();

  // ------------------------------------------------------------- session
  const [session, setSession] = useState<{ uid: string; result: JudgeSessionResult } | null>(null);
  const [entrancePending, startEntrance] = useTransition();
  const [entranceMessage, setEntranceMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [code, setCode] = useState("");

  // Bumped to re-read the session (after applying); the effect below owns the fetch.
  const [sessionNonce, setSessionNonce] = useState(0);

  useEffect(() => {
    if (authLoading || !user) return;
    const uid = user.uid;
    let cancelled = false;
    (async () => {
      const token = await idTokenFor(user);
      const result = await getJudgeSessionAction(token);
      if (!cancelled) setSession({ uid, result });
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, sessionNonce]);

  const resolving = authLoading || Boolean(user && session?.uid !== user.uid);
  const active: JudgeSessionView | null =
    user && session?.uid === user.uid && session.result.status === "active" ? session.result.session : null;

  let entrance: EntranceView;
  if (!user) entrance = { view: "signed_out" };
  else if (active) entrance = { view: "active", judgeName: active.judgeName };
  else if (session?.uid === user.uid && session.result.status === "pending") entrance = { view: "pending", message: session.result.message };
  else if (session?.uid === user.uid && session.result.status === "denied") entrance = { view: "denied", message: session.result.message };
  else if (session?.uid === user.uid && session.result.status === "unavailable") entrance = { view: "unavailable", message: session.result.message };
  else entrance = { view: "apply" };

  function handleSignIn() {
    setEntranceMessage(null);
    startEntrance(async () => {
      try {
        await signInWithPopup(auth, new GoogleAuthProvider());
      } catch {
        setEntranceMessage({ tone: "error", text: "Sign-in was cancelled or failed. Try again." });
      }
    });
  }

  function handleSignOut() {
    resetReview();
    setCode("");
    setEntranceMessage(null);
    setSession(null);
    writeResultsKey(null);
    signOut().catch(() => undefined);
  }

  function handleApply() {
    if (!user || !code.trim()) return;
    setEntranceMessage(null);
    startEntrance(async () => {
      const token = await idTokenFor(user);
      const report = await applyAsJudgeAction(token, code.trim());
      setEntranceMessage({ tone: report.status === "success" ? "ok" : "error", text: report.message });
      if (report.status === "success") setSessionNonce((n) => n + 1);
    });
  }

  // -------------------------------------------------------------- search
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<JudgeSearchResult>(emptySearch);
  const [searchPending, startSearch] = useTransition();

  const runSearch = useCallback(
    (q: string) => {
      startSearch(async () => {
        const token = await idTokenFor(user);
        setSearch(await searchJudgeTeamsAction(token, q));
      });
    },
    [user],
  );

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => runSearch(query), 220);
    return () => clearTimeout(timer);
  }, [active, query, runSearch]);

  // -------------------------------------------------------------- review
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [context, setContext] = useState<JudgeReviewContext | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewPending, startReview] = useTransition();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [review, setReview] = useState("");
  const [saved, setSaved] = useState<JudgeEvaluationView | null>(null);
  const [submitPending, startSubmit] = useTransition();
  const [feedback, setFeedback] = useState<JudgeSubmitReport | null>(null);

  function resetReview() {
    setSelectedId(null);
    setContext(null);
    setReviewError(null);
    setScores({});
    setReview("");
    setSaved(null);
    setFeedback(null);
  }

  function loadReview(teamId: number) {
    startReview(async () => {
      setReviewError(null);
      const token = await idTokenFor(user);
      const result = await getJudgeReviewAction(token, teamId);
      if (result.status === "error") {
        setReviewError(result.message);
        setContext(null);
        return;
      }
      setContext(result.context);
      const evaluation = result.context.evaluation;
      setSaved(evaluation);
      setScores(evaluation ? Object.fromEntries(evaluation.scores.map((s) => [s.criterionId, s.score])) : {});
      setReview(evaluation?.review ?? "");
    });
  }

  function selectTeam(teamId: number) {
    resetReview();
    setSelectedId(teamId);
    loadReview(teamId);
  }

  function handleSubmit() {
    if (!context || !user) return;
    startSubmit(async () => {
      const token = await idTokenFor(user);
      const result = await submitJudgeEvaluationAction(token, context.team.id, { review, scores });
      setFeedback(result);
      if (result.status === "success") {
        setSaved(result.evaluation);
        runSearch(query);
      }
    });
  }

  const criteria = active?.criteria ?? [];
  const maxTotal = active?.maxTotal ?? 0;
  const total = criteria.reduce((sum, c) => sum + (scores[c.id] ?? 0), 0);
  const complete = criteria.length > 0 && criteria.every((c) => scores[c.id] !== undefined);

  // ------------------------------------------------------------- results
  const [resultsDialog, setResultsDialog] = useState(false);

  // -------------------------------------------------------------- render
  return (
    <main className="flex min-h-dvh flex-col overflow-x-hidden bg-black p-4 pt-20 text-zinc-100 sm:p-[3%] sm:pt-24">
      <div className={`mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 ${context ? "pb-24" : ""}`}>
        <header className="flex flex-wrap items-end justify-between gap-4 px-1">
          <div>
            <Eyebrow tone="neon">Judge portal</Eyebrow>
            <h1 className="mt-2 text-3xl font-semibold tracking-wide text-white sm:text-4xl">Judge review.</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
              Find a team, see what it acquired at the auction, score it against the rubric, submit.
            </p>
          </div>
          {active ? <Chip tone="neon">{active.eventName}</Chip> : null}
        </header>

        {resolving ? (
          <div className="h-28 animate-pulse rounded-2xl border border-white/10 bg-zinc-950" />
        ) : (
          <JudgeEntrance
            view={entrance}
            email={user?.email ?? null}
            code={code}
            pending={entrancePending}
            message={entranceMessage}
            onCodeChange={setCode}
            onApply={handleApply}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
          />
        )}

        {active && !selectedId ? (
          <TeamSearch
            query={query}
            onQueryChange={setQuery}
            result={search}
            pending={searchPending}
            maxTotal={maxTotal}
            onSelect={selectTeam}
          />
        ) : null}

        {active && selectedId ? (
          <>
            <button type="button" onClick={resetReview} className={`${ghostButton} h-9 w-fit px-4 text-xs`}>
              <span aria-hidden>←</span> Find another team
            </button>

            {reviewPending && !context ? (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
                <div className="space-y-4">
                  <div className="h-44 animate-pulse rounded-2xl border border-white/10 bg-zinc-950" />
                  <div className="h-64 animate-pulse rounded-2xl border border-white/10 bg-zinc-950" />
                </div>
                <div className="h-[560px] animate-pulse rounded-2xl border border-white/10 bg-zinc-950" />
              </div>
            ) : reviewError ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-5">
                <p className="text-sm text-red-200">{reviewError}</p>
                <button
                  type="button"
                  onClick={() => loadReview(selectedId)}
                  className="mt-3 rounded-lg border border-red-500/40 px-3 py-2 text-xs font-semibold tracking-wide text-red-300 uppercase hover:bg-red-500/10"
                >
                  Retry
                </button>
              </div>
            ) : context ? (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
                <div className="space-y-4">
                  <TeamOverview team={context.team} evaluation={saved} maxTotal={maxTotal} />
                  <AuctionResources resources={context.resources} />
                </div>
                <EvaluationForm
                  criteria={criteria}
                  scores={scores}
                  review={review}
                  evaluation={saved}
                  maxTotal={maxTotal}
                  onChange={(id, value) => {
                    setScores((prev) => ({ ...prev, [id]: value }));
                    setFeedback(null);
                  }}
                  onReviewChange={setReview}
                />
              </div>
            ) : null}
          </>
        ) : null}

        {active ? (
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neon/20 bg-zinc-950/60 px-4 py-3">
            <p className="text-xs leading-5 text-zinc-500">
              Every judge&apos;s submitted scores and notes, grouped by team. You will be asked to confirm
              your name and invitation code.
            </p>
            <button
              type="button"
              onClick={() => setResultsDialog(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-neon/60 bg-neon/10 px-5 text-sm font-semibold text-neon transition hover:bg-neon/20"
            >
              Go to evaluations
              <span aria-hidden>→</span>
            </button>
          </div>
        ) : null}
      </div>

      {active && context ? (
        <SubmitBar
          total={total}
          maxTotal={maxTotal}
          complete={complete}
          isUpdate={Boolean(saved)}
          pending={submitPending}
          feedback={feedback}
          onFindTeam={resetReview}
          onSubmit={handleSubmit}
        />
      ) : null}

      {resultsDialog ? <ResultsAccessDialog user={user} onClose={() => setResultsDialog(false)} /> : null}
    </main>
  );
}
