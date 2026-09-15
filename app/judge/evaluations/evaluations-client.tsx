"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Chip, CornerMarks, Eyebrow, Panel, ghostButton } from "@/components/ui/panel";
import { getJudgeResultsAction, type JudgeResultsView } from "../actions";
import { idTokenFor, readResultsKey } from "../judge-session";

function submittedAt(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "Not submitted";
}

/**
 * Every judge's submitted evaluation, grouped by team, best average first.
 *
 * Reachable only through the popup on /judge: it stores the invitation code
 * for this tab, and the backend refuses the results read without a valid
 * code and a signed-in judge with an active assignment. Opening this URL
 * cold shows the refusal and a way back — nothing about any team is
 * rendered from a cached copy.
 */
export function EvaluationsClient() {
  const { user, loading } = useAuth();
  const [state, setState] = useState<{ status: "loading" } | { status: "refused"; message: string } | { status: "ready"; results: JudgeResultsView }>({
    status: "loading",
  });

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      const key = readResultsKey();
      const token = await idTokenFor(user);
      if (!token || !key) {
        if (!cancelled) setState({ status: "refused", message: "Verify yourself from the judge portal before opening the evaluations." });
        return;
      }
      const results = await getJudgeResultsAction(token, key);
      if (cancelled) return;
      if (results.status !== "success") {
        setState({ status: "refused", message: results.message ?? "Could not load the evaluations." });
        return;
      }
      setState({ status: "ready", results });
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  if (state.status === "loading") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-black pt-16">
        <Chip tone="muted">Loading evaluations…</Chip>
      </main>
    );
  }

  if (state.status === "refused") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-black p-4 pt-20">
        <Panel tone="amber" className="relative w-full max-w-md p-6 sm:p-8">
          <CornerMarks />
          <Eyebrow tone="amber">Not verified</Eyebrow>
          <h1 className="mt-2 text-2xl font-semibold text-white">Open this from the judge portal.</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{state.message}</p>
          <Link href="/judge" className={`${ghostButton} mt-5`}>
            <span aria-hidden>←</span> Judge portal
          </Link>
        </Panel>
      </main>
    );
  }

  const { results } = state;
  const criteriaById = new Map(results.criteria.map((c) => [c.id, c]));

  return (
    <main className="flex min-h-dvh flex-col overflow-x-hidden bg-black p-4 pt-20 text-zinc-100 sm:p-[3%] sm:pt-24">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-4 px-1">
          <div>
            <Eyebrow tone="neon">{results.eventName}</Eyebrow>
            <h1 className="mt-2 text-3xl font-semibold tracking-wide text-white sm:text-4xl">Team evaluations.</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
              Submitted scores and notes from every judge, grouped by team. Best average first.
            </p>
          </div>
          <Link href="/judge" className={`${ghostButton} h-10 px-4 text-xs`}>
            <span aria-hidden>←</span> Back to judging
          </Link>
        </header>

        {results.teams.length === 0 ? (
          <Panel className="p-6 text-sm text-zinc-400">No submitted evaluations yet.</Panel>
        ) : (
          results.teams.map((team, index) => (
            <Panel key={team.id} className="relative p-5 sm:p-6">
              <CornerMarks />
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neon/10 pb-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-neon/20 font-mono text-xs text-neon">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-mono text-[0.65rem] tracking-[0.14em] text-neon uppercase">{team.code}</p>
                    <h2 className="mt-0.5 text-2xl font-semibold text-white">{team.name}</h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      {team.evaluations.length} submitted {team.evaluations.length === 1 ? "evaluation" : "evaluations"}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-neon/30 bg-neon/[0.05] px-4 py-3 text-right">
                  <p className="text-[0.6rem] tracking-[0.14em] text-zinc-500 uppercase">Average</p>
                  <p className="mt-1 font-mono text-2xl font-semibold text-neon">
                    {team.average.toFixed(1)} <span className="text-sm text-zinc-500">/ {results.maxTotal}</span>
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {team.evaluations.map((evaluation) => (
                  <article key={evaluation.id} className="rounded-xl border border-white/10 bg-black/40 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{evaluation.judgeName}</p>
                        <p className="mt-0.5 font-mono text-[0.62rem] text-zinc-500">{submittedAt(evaluation.submittedAt)}</p>
                      </div>
                      <p className="font-mono text-lg font-semibold text-white">
                        {evaluation.total} <span className="text-xs text-zinc-500">/ {results.maxTotal}</span>
                      </p>
                    </div>
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {evaluation.scores
                        .map((score) => ({ score, criterion: criteriaById.get(score.criterionId) }))
                        .filter((entry) => entry.criterion)
                        .sort((a, b) => a.criterion!.displayOrder - b.criterion!.displayOrder)
                        .map(({ score, criterion }) => (
                          <li key={score.criterionId} className="rounded-md border border-white/10 bg-zinc-950 px-2 py-1 font-mono text-[0.62rem] text-zinc-400">
                            {criterion!.name}{" "}
                            <span className="font-semibold text-zinc-100">
                              {score.score}/{criterion!.maxScore}
                            </span>
                          </li>
                        ))}
                    </ul>
                    {evaluation.review ? (
                      <div className="mt-3 border-l-2 border-neon/50 pl-3">
                        <p className="text-[0.6rem] tracking-[0.14em] text-zinc-500 uppercase">Notes</p>
                        <p className="mt-1 text-sm leading-6 whitespace-pre-wrap text-zinc-300">{evaluation.review}</p>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </Panel>
          ))
        )}
      </div>
    </main>
  );
}
