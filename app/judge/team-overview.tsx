"use client";

import { Chip, Eyebrow, Panel } from "@/components/ui/panel";
import { Credits } from "@/app/bidding/credits";
import { sourceLabel } from "@/app/bidding/resource-manager";
import type { JudgeEvaluationView, JudgeResources, JudgeReviewContext } from "./actions";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

/** The team under review: roster, and whether this judge has scored it. */
export function TeamOverview({
  team,
  evaluation,
  maxTotal,
}: {
  team: JudgeReviewContext["team"];
  evaluation: JudgeEvaluationView | null;
  maxTotal: number;
}) {
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>Now evaluating</Eyebrow>
          <h2 className="mt-1 truncate text-xl font-semibold text-white">{team.name}</h2>
          <p className="font-mono text-[0.65rem] text-zinc-500">{team.code}</p>
        </div>
        {evaluation ? <Chip tone="neon">Submitted</Chip> : <Chip tone="amber">Not scored</Chip>}
      </div>
      {evaluation ? (
        <p className="mt-2 font-mono text-[0.62rem] text-zinc-500">
          {evaluation.total}/{maxTotal} · updated {timeAgo(evaluation.updatedAt)}
          {evaluation.review ? " · notes included" : ""}
        </p>
      ) : null}
      <ul className="mt-4 space-y-1.5">
        {team.members.map((member) => (
          <li
            key={member.email}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
              member.isLeader ? "border-neon/30 bg-neon/[0.05]" : "border-white/5 bg-black/30"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-100">{member.name}</p>
              <p className="truncate font-mono text-[0.6rem] text-zinc-500">{member.email}</p>
            </div>
            <span className={`shrink-0 font-mono text-[0.58rem] tracking-[0.12em] uppercase ${member.isLeader ? "text-neon" : "text-zinc-600"}`}>
              {member.isLeader ? "Lead" : "Member"}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** What the team bought at the auction — the constraints it built under. */
export function AuctionResources({ resources }: { resources: JudgeResources }) {
  const spentPercent = Math.min(100, Math.round((resources.spent / Math.max(1, resources.startingBudget)) * 100));

  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between">
        <Eyebrow tone="neon">What they acquired</Eyebrow>
        <span className="size-1.5 rounded-full bg-neon/60" aria-hidden />
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-[0.6rem] tracking-[0.14em] text-zinc-500 uppercase">Spent</span>
        <span className="font-mono text-lg font-semibold text-neon">
          <Credits value={resources.spent} />
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800" role="img" aria-label={`${resources.spent} of ${resources.startingBudget} credits spent`}>
        <div className="h-full rounded-full bg-neon/70" style={{ width: `${spentPercent}%` }} />
      </div>
      <p className="mt-1.5 font-mono text-[0.6rem] text-zinc-600">
        of {resources.startingBudget.toLocaleString("en-US")} · <Credits value={resources.remaining} /> left unspent
      </p>

      <ul className="mt-4 space-y-1.5">
        {resources.items.length === 0 ? (
          <li className="rounded-lg border border-dashed border-zinc-800 px-3 py-3 text-xs text-zinc-500">
            No settlements yet — this team has not been through the auction.
          </li>
        ) : (
          resources.items.map((item) => (
            <li key={`${item.roundOrder}-${item.tierName}`} className="rounded-lg border border-neon/20 bg-neon/[0.04] px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[0.66rem] tracking-wide text-zinc-500 uppercase">
                  {item.roundOrder}. {item.roundName}
                </span>
                <span className="shrink-0 font-mono text-xs font-semibold text-neon">
                  <Credits value={item.pricePaid} />
                </span>
              </div>
              <p className="mt-0.5 truncate text-sm text-zinc-100">{item.tierName}</p>
              <p className="font-mono text-[0.56rem] text-zinc-600">{sourceLabel[item.priceSource] ?? item.priceSource}</p>
            </li>
          ))
        )}
      </ul>
    </Panel>
  );
}
