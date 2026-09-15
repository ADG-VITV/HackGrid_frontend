"use client";

import { Credits } from "./credits";
import { sourceLabel } from "./resource-manager";
import type { PodSummary, PriceSource } from "./actions";
import type { RoomState } from "@/lib/socket-events";

/** One line of the pod's final table: a team and the tier it ended up with. */
export type PodResultRow = {
  teamId: number;
  teamName: string;
  leadName: string;
  tierName: string | null;
  tierRank: number | null;
  pricePaid: number | null;
  priceSource: PriceSource | null;
};

/** The rows from a live room snapshot — every lot in the pod is CLOSED. */
export function rowsFromRoom(room: RoomState): PodResultRow[] {
  const byTeam = new Map(
    room.lots
      .filter((lot) => lot.result)
      .map((lot) => [lot.result!.teamId, { lot, result: lot.result! }] as const),
  );
  return room.members.map((member) => {
    const hit = byTeam.get(member.teamId);
    return {
      teamId: member.teamId,
      teamName: member.teamName,
      leadName: member.leadName,
      tierName: hit?.lot.name ?? null,
      tierRank: hit?.lot.tierRank ?? null,
      pricePaid: hit?.result.pricePaid ?? null,
      priceSource: hit?.result.priceSource ?? null,
    };
  });
}

/** The same rows from the context API, for when the room has already closed. */
export function rowsFromSummary(summary: PodSummary): PodResultRow[] {
  return summary.teams.map((team) => ({
    teamId: team.teamId,
    teamName: team.teamName,
    leadName: team.leadName,
    tierName: team.result?.tierName ?? null,
    tierRank: team.result?.tierRank ?? null,
    pricePaid: team.result?.pricePaid ?? null,
    priceSource: team.result?.priceSource ?? null,
  }));
}

/**
 * What a pod sees once every one of its tiers has settled: the round is over
 * for them. Your own result up top, then who in the pod got what, then what
 * happens next — nothing, until the organiser opens the next round. Replaces
 * the bidding column, so no price, no bid box and no clock remain on screen.
 *
 * `capsuleClosed` distinguishes "your pod is done, other pods may still be
 * bidding" from "the whole round is closed".
 */
export function RoundComplete({
  capsuleName,
  podLabel,
  rows,
  youTeamId,
  capsuleClosed,
  nextCapsuleName,
}: {
  capsuleName: string;
  podLabel: string;
  rows: PodResultRow[];
  /** Null for a member watching — nothing is highlighted as "you" then. */
  youTeamId: number | null;
  capsuleClosed: boolean;
  /** Null after the last round. */
  nextCapsuleName: string | null;
}) {
  const ordered = [...rows].sort(
    (a, b) => (a.tierRank ?? Number.MAX_SAFE_INTEGER) - (b.tierRank ?? Number.MAX_SAFE_INTEGER),
  );
  const you = youTeamId === null ? null : (rows.find((row) => row.teamId === youTeamId) ?? null);

  return (
    <div className="flex flex-1 flex-col">
      <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-neon uppercase">
        {capsuleName} · {podLabel} · {capsuleClosed ? "round closed" : "your pod is done"}
      </p>
      <h4 className="mt-2 text-2xl font-semibold text-white lg:text-3xl">
        {capsuleName} has ended{capsuleClosed ? "." : " for your pod."}
      </h4>

      {you ? (
        <div className="mt-4 rounded-xl border border-neon/50 bg-neon/[0.08] px-4 py-3">
          <p className="text-[0.6rem] tracking-[0.14em] text-zinc-500 uppercase">Your team secured</p>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
            <span className="text-lg font-semibold text-white">{you.tierName ?? "Nothing this round"}</span>
            {you.pricePaid !== null ? (
              <span className="font-mono text-2xl font-semibold text-neon">
                <Credits value={you.pricePaid} />
              </span>
            ) : null}
          </div>
          {you.priceSource ? (
            <p className="mt-1 font-mono text-[0.6rem] text-zinc-500">
              {sourceLabel[you.priceSource] ?? you.priceSource}
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="mt-5 text-[0.6rem] tracking-[0.14em] text-zinc-500 uppercase">
        Who got what in {podLabel}
      </p>
      <ol className="mt-2 divide-y divide-white/5 rounded-xl border border-white/10 bg-black/40">
        {ordered.map((row) => {
          const isYou = row.teamId === youTeamId;
          return (
            <li
              key={row.teamId}
              className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm ${
                isYou ? "bg-neon/[0.06]" : ""
              }`}
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-zinc-900 font-mono text-[0.6rem] text-zinc-500">
                {row.tierRank ?? "—"}
              </span>
              <span className={`min-w-0 flex-1 truncate ${isYou ? "font-semibold text-neon" : "text-zinc-200"}`}>
                {row.tierName ?? <span className="text-zinc-600">No tier</span>}
              </span>
              <span className="min-w-0 truncate text-zinc-400">
                {row.teamName}
                {isYou ? <span className="ml-1.5 text-[0.62rem] text-neon">you</span> : null}
                <span className="ml-1.5 font-mono text-[0.6rem] text-zinc-600">{row.leadName}</span>
              </span>
              <span className="ml-auto shrink-0 text-right">
                {row.pricePaid !== null ? (
                  <span className="font-mono text-sm text-neon">
                    <Credits value={row.pricePaid} />
                  </span>
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
                {row.priceSource ? (
                  <span className="block font-mono text-[0.55rem] text-zinc-600">
                    {sourceLabel[row.priceSource] ?? row.priceSource}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        {nextCapsuleName ? (
          <>
            <strong className="font-semibold">Waiting for the organiser to start {nextCapsuleName}.</strong>
            <span className="mt-1 block text-zinc-300">
              {capsuleClosed
                ? "This panel folds away and the next round opens here on its own the moment they do — you will be seated in a new pod."
                : "Other pods in this round may still be bidding; the round closes when the last of them settles. Then the next round opens here on its own when the organiser starts it."}
            </span>
          </>
        ) : (
          <>
            <strong className="font-semibold">That was the last round.</strong>
            <span className="mt-1 block text-zinc-300">
              Your final product spec is in the Resource Manager.
            </span>
          </>
        )}
      </div>
    </div>
  );
}
