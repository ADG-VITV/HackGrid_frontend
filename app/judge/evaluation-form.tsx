"use client";

import { Eyebrow, Panel } from "@/components/ui/panel";
import type { JudgeCriterionView, JudgeEvaluationView } from "./actions";

/**
 * One criterion: a slider with −/+ nudges, bounded by the criterion's own
 * min/max from the server. Untouched shows "–" so a judge cannot submit a
 * default 0 they never chose.
 */
function ScoreInput({
  criterion,
  value,
  onChange,
}: {
  criterion: JudgeCriterionView;
  value: number | undefined;
  onChange: (criterionId: string, value: number) => void;
}) {
  const { minScore: min, maxScore: max } = criterion;
  const current = value ?? min;
  const touched = value !== undefined;
  const fill = touched ? ((current - min) / Math.max(1, max - min)) * 100 : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-zinc-100">{criterion.name}</h4>
          <p className="mt-0.5 text-[0.68rem] leading-5 text-zinc-500">{criterion.description}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-0.5 font-mono text-[0.6rem] font-semibold text-zinc-400">
          {max} pts
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          aria-label={`Decrease ${criterion.name}`}
          disabled={current <= min}
          onClick={() => onChange(criterion.id, Math.max(min, current - 1))}
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-neon/40 bg-neon/[0.08] text-neon transition hover:bg-neon/20 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <span aria-hidden>−</span>
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={current}
          onChange={(event) => {
            const next = Number.parseInt(event.target.value, 10);
            if (Number.isFinite(next)) onChange(criterion.id, next);
          }}
          className="hg-range h-8 w-full cursor-pointer"
          style={{ "--fill": `${fill}%` } as React.CSSProperties}
          aria-label={criterion.name}
        />
        <button
          type="button"
          aria-label={`Increase ${criterion.name}`}
          disabled={current >= max}
          onClick={() => onChange(criterion.id, Math.min(max, current + 1))}
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-neon/40 bg-neon/[0.08] text-neon transition hover:bg-neon/20 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <span aria-hidden>+</span>
        </button>
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-[0.6rem] tracking-[0.14em] text-zinc-600 uppercase">Score</span>
        <span className="font-mono text-xl font-semibold">
          <span className={touched ? "text-neon" : "text-zinc-500"}>{touched ? current : "–"}</span>
          <span className="ml-1 text-xs text-zinc-600">/ {max}</span>
        </span>
      </div>
    </div>
  );
}

export function EvaluationForm({
  criteria,
  scores,
  review,
  evaluation,
  maxTotal,
  onChange,
  onReviewChange,
}: {
  criteria: JudgeCriterionView[];
  scores: Record<string, number>;
  review: string;
  evaluation: JudgeEvaluationView | null;
  maxTotal: number;
  onChange: (criterionId: string, value: number) => void;
  onReviewChange: (review: string) => void;
}) {
  return (
    <Panel className="space-y-4 p-5">
      <details className="group rounded-2xl border border-white/10 bg-black/40 p-4">
        <summary className="cursor-pointer list-none marker:hidden">
          <span className="flex items-center justify-between">
            <Eyebrow>How to evaluate</Eyebrow>
            <span className="text-sm text-neon transition-transform group-open:rotate-90">›</span>
          </span>
        </summary>
        <div className="mt-3 text-xs leading-6 text-zinc-400">
          <p className="font-medium text-zinc-200">The core question:</p>
          <p className="mt-1 italic">
            &ldquo;Given the resources this team acquired, did they build the strongest startup they
            reasonably could have?&rdquo;
          </p>
          <p className="mt-3 text-zinc-500">
            Teams are judged relative to what they acquired, not against a fixed standard. A team
            that spent heavily should show a correspondingly stronger product; a team that spent
            conservatively should show smart, efficient use of limited resources. Spending the most
            is not, by itself, rewarded.
          </p>
        </div>
      </details>

      <div className="flex items-baseline justify-between">
        <Eyebrow tone="neon">Evaluation criteria</Eyebrow>
        <span className="font-mono text-[0.6rem] font-semibold text-zinc-500">{maxTotal} pts total</span>
      </div>

      {evaluation ? (
        <p className="rounded-xl border border-neon/30 bg-neon/[0.05] px-4 py-2.5 text-xs text-zinc-400">
          You already submitted{" "}
          <span className="font-mono font-semibold text-neon">
            {evaluation.total}/{maxTotal}
          </span>{" "}
          for this team — change the scores below and resubmit to replace it.
        </p>
      ) : null}

      {criteria.map((criterion) => (
        <ScoreInput key={criterion.id} criterion={criterion} value={scores[criterion.id]} onChange={onChange} />
      ))}

      <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
        <h4 className="text-sm font-semibold text-zinc-100">Review notes</h4>
        <p className="mt-0.5 text-[0.68rem] leading-5 text-zinc-500">
          Optional. A short justification, shown alongside your scores on the evaluations page.
        </p>
        <textarea
          value={review}
          onChange={(event) => onReviewChange(event.target.value)}
          rows={4}
          placeholder="What stood out about this team's build and how they used what they bought?"
          className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-black px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-neon/70"
        />
      </div>
    </Panel>
  );
}
