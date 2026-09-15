"use client";

import { ghostButton, primaryButton } from "@/components/ui/panel";
import type { JudgeSubmitReport } from "./actions";

/** Sticky footer while reviewing: running total, submit, and the server's answer. */
export function SubmitBar({
  total,
  maxTotal,
  complete,
  isUpdate,
  pending,
  feedback,
  onFindTeam,
  onSubmit,
}: {
  total: number;
  maxTotal: number;
  complete: boolean;
  isUpdate: boolean;
  pending: boolean;
  feedback: JudgeSubmitReport | null;
  onFindTeam: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neon/20 bg-black/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-baseline gap-2">
          <span className="text-[0.6rem] tracking-[0.14em] text-zinc-500 uppercase">Total</span>
          <span className={`font-mono text-2xl font-semibold ${complete ? "text-neon" : "text-zinc-300"}`}>{total}</span>
          <span className="font-mono text-xs text-zinc-600">/ {maxTotal}</span>
        </div>

        {feedback ? (
          <p
            className={`min-w-0 flex-1 truncate text-xs ${
              feedback.status === "success" ? "text-neon" : "text-red-300"
            }`}
            aria-live="polite"
          >
            {feedback.message}
          </p>
        ) : (
          <p className="min-w-0 flex-1 truncate text-xs text-zinc-600">
            {complete ? "Every criterion is scored." : "Score every criterion to submit."}
          </p>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onFindTeam} className={`${ghostButton} h-10 px-4 text-xs`}>
            Find another team
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!complete || pending}
            className={`${primaryButton} h-10 px-5 text-xs`}
          >
            {pending ? "Saving…" : isUpdate ? "Resubmit" : "Submit evaluation"}
          </button>
        </div>
      </div>
    </div>
  );
}
