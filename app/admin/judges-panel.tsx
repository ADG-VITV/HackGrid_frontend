"use client";

import type { AdminReport, JudgingAdminContext } from "./actions";
import { reviewJudgeApplicationAction, setJudgeStatusAction } from "./actions";

function when(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

const applicationTone: Record<string, string> = {
  PENDING: "border-amber-500/40 text-amber-300",
  APPROVED: "border-neon/50 text-neon",
  REJECTED: "border-red-500/50 text-red-300",
};

/**
 * The organiser's view of judging: who applied with the invitation code and
 * needs a decision, and who is already a judge (with the power to suspend
 * or reinstate). Rides the same context poll as the rest of the page.
 */
export function JudgesPanel({
  judging,
  pending,
  run,
}: {
  judging: JudgingAdminContext | null;
  pending: boolean;
  run: (action: () => Promise<AdminReport>) => void;
}) {
  const applications = judging?.applications ?? [];
  const judges = judging?.judges ?? [];
  const awaiting = applications.filter((a) => a.status === "PENDING").length;

  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-zinc-950 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-400">Judges</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Applications and access</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            A judge signs in with Google on <span className="font-mono text-zinc-200">/judge</span> and enters
            the invitation code; approve them here to let them score. Suspending a judge keeps their
            evaluations but blocks new ones.
          </p>
        </div>
        {judging && !judging.seeded ? (
          <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            Judging is not seeded on the backend yet — run <span className="font-mono">npm run db:seed</span>{" "}
            with <span className="font-mono">HACKGRID_JUDGE_INVITE_CODE</span> set.
          </p>
        ) : awaiting > 0 ? (
          <span className="rounded-full border border-amber-500/40 px-3 py-1 text-xs font-semibold text-amber-300">
            {awaiting} awaiting decision
          </span>
        ) : null}
      </div>

      <div className="mt-5 overflow-x-auto">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Applications</p>
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="pb-2 pr-4 font-medium">Applicant</th>
              <th className="pb-2 pr-4 font-medium">Submitted</th>
              <th className="pb-2 pr-4 font-medium">Status</th>
              <th className="pb-2 font-medium">Decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-zinc-300">
            {applications.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-zinc-500">
                  No judge applications yet.
                </td>
              </tr>
            ) : (
              applications.map((application) => (
                <tr key={application.id}>
                  <td className="py-2.5 pr-4">
                    <span className="block font-medium text-white">{application.name}</span>
                    <span className="font-mono text-xs text-zinc-500">{application.email}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-zinc-500">{when(application.submittedAt)}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${applicationTone[application.status]}`}>
                      {application.status}
                    </span>
                  </td>
                  <td className="py-2.5">
                    {application.status === "PENDING" ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => reviewJudgeApplicationAction(application.id, "APPROVED"))}
                          className="rounded-lg border border-neon/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-neon hover:bg-neon/10 disabled:opacity-40"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            if (window.confirm(`Reject ${application.name}? They cannot reapply with this account.`)) {
                              run(() => reviewJudgeApplicationAction(application.id, "REJECTED"));
                            }
                          }}
                          className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-600">
                        {application.reviewedAt ? `Reviewed ${when(application.reviewedAt)}` : "Reviewed"}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 overflow-x-auto border-t border-white/5 pt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Approved judges</p>
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="pb-2 pr-4 font-medium">Judge</th>
              <th className="pb-2 pr-4 font-medium">Approved</th>
              <th className="pb-2 pr-4 font-medium">Evaluations</th>
              <th className="pb-2 pr-4 font-medium">Access</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-zinc-300">
            {judges.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-zinc-500">
                  Nobody has been approved yet.
                </td>
              </tr>
            ) : (
              judges.map((judge) => {
                const active = judge.status === "ACTIVE";
                return (
                  <tr key={judge.judgeId}>
                    <td className="py-2.5 pr-4">
                      <span className="block font-medium text-white">{judge.name}</span>
                      <span className="font-mono text-xs text-zinc-500">{judge.email}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-zinc-500">{when(judge.approvedAt)}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-zinc-400">{judge.evaluationCount}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${active ? "border-neon/50 text-neon" : "border-zinc-600 text-zinc-400"}`}>
                        {judge.status}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          if (active && !window.confirm(`Suspend ${judge.name}? They keep their evaluations but cannot submit more until reinstated.`)) return;
                          run(() => setJudgeStatusAction(judge.judgeId, active ? "SUSPENDED" : "ACTIVE"));
                        }}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide disabled:opacity-40 ${
                          active
                            ? "border-red-500/40 text-red-300 hover:bg-red-500/10"
                            : "border-neon/50 text-neon hover:bg-neon/10"
                        }`}
                      >
                        {active ? "Suspend" : "Reinstate"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
