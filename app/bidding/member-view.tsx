"use client";

import Link from "next/link";
import type { BiddingContext, PodSummary } from "./actions";
import { Credits } from "./credits";
import { ResourceManager, sourceLabel } from "./resource-manager";
import { RoundComplete, rowsFromSummary } from "./round-complete";
import { secondsUntil } from "./use-auction-socket";
import { Chip, CornerMarks, Eyebrow, Panel, ghostButton } from "@/components/ui/panel";

function formatTimer(seconds: number | null) {
  if (seconds === null) return "—:—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * What a team member sees on the bidding page.
 *
 * Members never enter a pod room — only the lead's account is let in, and a
 * second socket would count towards quorum. So this view is fed by the same
 * database read the ledger uses, polled while a round is live. It is laid out
 * like the lead's room: the round's status on the left, the pod on the right
 * — the tier the lead is bidding on, then, the moment the team's lot settles,
 * what the team secured, and once the pod is done, who in it got what. The
 * Resource Manager alongside shows the same settlements the lead sees, at
 * the same time; it is the only place the four rounds are listed.
 */
export function MemberView({ context, polling }: { context: BiddingContext; polling: boolean }) {
  const team = context.team!;
  const live = context.capsules.findLast((capsule) => capsule.status === "LIVE") ?? null;
  const started = context.capsules.some((capsule) => capsule.status !== "PENDING");
  const complete = started && context.capsules.every((capsule) => capsule.status === "CLOSED");
  const lot = context.currentLot;
  // Set by the server from the settlements table the instant the team's lot
  // closes. Once it exists the lead is out of this round, so the pod's next
  // open tier is no longer "what your lead is fighting for".
  const won = context.currentResult;
  // The team's pod in the live round, or in the one that just finished —
  // everyone in it and what they ended up with, from the same settlements.
  const pod = context.podSummary;
  const podDone = Boolean(pod?.complete);
  // The side column tracks the pod *while it is bidding* (who is still in,
  // how many tiers are settled). Once every tier has settled, RoundComplete
  // lists the same teams with the same tiers and prices, so showing both is
  // the same table twice — the results list takes the whole width instead.
  const showPodColumn = Boolean(pod) && !podDone;
  const luckyPod = pod?.podKind === "REMAINDER";
  // A lucky pod of one never bids: its lead picks a tier at a fixed price,
  // so there is no "tier on the block" and no clock to show.
  const leadPicking = luckyPod && pod !== null && pod.teams.length === 1 && Boolean(live) && !won && !podDone;
  const nextCapsule =
    context.capsules.find((capsule) => capsule.status !== "CLOSED" && capsule.key !== live?.key) ?? null;
  const secondsLeft = secondsUntil(lot?.closesAt ?? null, 0);

  // The round the panel is about: the live one, else the one that just
  // finished (its pod stays up until the organiser opens the next).
  const shownName = live?.name ?? pod?.capsuleName ?? null;
  const shownOrder = live?.sequenceOrder ?? context.capsules.find((c) => c.key === pod?.capsuleKey)?.sequenceOrder ?? null;

  return (
    <main className="flex min-h-dvh flex-col overflow-x-hidden bg-black p-4 pt-20 text-zinc-100 sm:p-[3%] sm:pt-24">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-neon/20 bg-zinc-950/60 px-4 py-3">
          <Chip tone={live ? "neon" : "muted"}>{live ? (polling ? "Following" : "Live") : "Standby"}</Chip>
          <span className="text-sm text-zinc-300">
            {team.name} · {team.code}
          </span>
          <Chip tone="muted">Member</Chip>
          <span className="ml-auto text-xs text-zinc-500">
            Lead <span className="text-zinc-200">{team.leadName}</span> bids for you
          </span>
        </div>

        <section className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-[2.5%]">
          <div className="flex min-w-0 flex-col gap-4 lg:w-[74%]">
            <Panel className="relative flex min-h-[420px] flex-col p-6 sm:p-8">
              <CornerMarks />

              {/* ------------------------------------------------ header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Eyebrow tone={shownName ? "neon" : "amber"}>
                  {shownName
                    ? `Round ${shownOrder} · ${shownName}${pod ? ` · ${pod.podLabel}` : ""}`
                    : "Standby"}
                  {shownName && luckyPod ? <span className="text-amber-300/80"> · lucky pod</span> : null}
                </Eyebrow>
                <span
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2 font-mono text-sm font-semibold ${
                    podDone || won
                      ? "border-neon/50 bg-neon/10 text-neon"
                      : lot?.closesAt
                        ? secondsLeft !== null && secondsLeft <= 10
                          ? "animate-pulse border-red-500/50 bg-red-500/10 text-red-400"
                          : "border-neon/40 bg-neon/[0.08] text-neon"
                        : "border-zinc-700 bg-zinc-900 text-zinc-400"
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {podDone
                    ? "ENDED"
                    : won
                      ? "DONE"
                      : leadPicking
                        ? "PICK"
                        : lot
                          ? lot.closesAt
                            ? formatTimer(secondsLeft)
                            : "ON HOLD"
                          : "—:—"}
                </span>
              </div>

              {/* ------------------------------------------- two columns */}
              <div className="flex min-w-0 flex-1 flex-col gap-6 pt-6 lg:flex-row lg:gap-[3%]">
                {/* status column */}
                <section className={`flex min-w-0 flex-col ${showPodColumn ? "lg:w-[58%]" : "flex-1"}`}>
                  {podDone && pod ? (
                    <RoundComplete
                      capsuleName={pod.capsuleName}
                      podLabel={pod.podLabel}
                      rows={rowsFromSummary(pod)}
                      youTeamId={team.id}
                      capsuleClosed={pod.capsuleStatus === "CLOSED"}
                      nextCapsuleName={nextCapsule?.name ?? null}
                    />
                  ) : live ? (
                    <div className="flex flex-1 flex-col justify-center py-4">
                      {won ? (
                        <>
                          <Eyebrow tone="neon">Your team secured</Eyebrow>
                          <h2 className="mt-3 text-3xl font-semibold tracking-wide text-white sm:text-4xl">
                            {won.tierName}
                          </h2>
                          <p className="mt-3 font-mono text-2xl font-semibold text-neon sm:text-3xl">
                            <Credits value={won.pricePaid} />
                          </p>
                          <p className="mt-4 max-w-lg text-sm leading-6 text-zinc-500">
                            {sourceLabel[won.priceSource] ?? won.priceSource} · your lead{" "}
                            <span className="text-zinc-200">{team.leadName}</span> is done for this round.
                            It is already deducted from the balance in the ledger. The rest of the pod is
                            still bidding; the next round opens when the organiser starts it.
                          </p>
                        </>
                      ) : leadPicking ? (
                        <>
                          <Eyebrow tone="amber">Lucky pod · just your team</Eyebrow>
                          <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
                            Your lead is picking a tier.
                          </h2>
                          <p className="mt-4 max-w-lg text-sm leading-6 text-zinc-500">
                            Your team is the only one in {pod?.podLabel}, so there is no bidding and no
                            clock. Every tier is on the table at the price the main pods averaged for it;
                            the one <span className="text-zinc-200">{team.leadName}</span> takes shows
                            here and in the ledger the moment it is done.
                          </p>
                        </>
                      ) : lot ? (
                        <>
                          <Eyebrow>On the block now</Eyebrow>
                          <h2 className="mt-3 text-3xl font-semibold tracking-wide text-white sm:text-4xl">
                            {lot.name}
                          </h2>
                          <p className="mt-4 max-w-lg text-sm leading-6 text-zinc-500">
                            Tier {lot.tierRank} of {live.tierCount}. Your lead{" "}
                            <span className="text-zinc-200">{team.leadName}</span> is in the room. The
                            moment your team&apos;s tier settles it shows here and in the ledger.
                          </p>
                        </>
                      ) : live.podId ? (
                        <>
                          <Eyebrow>Between tiers</Eyebrow>
                          <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
                            Nothing is open this second.
                          </h2>
                          <p className="mt-4 max-w-lg text-sm leading-6 text-zinc-500">
                            The next tier in {live.podLabel} opens on its own, or the pod is waiting on
                            the rest to arrive.
                          </p>
                        </>
                      ) : (
                        <>
                          <Eyebrow>Not seated</Eyebrow>
                          <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
                            Not in a pod this round.
                          </h2>
                          <p className="mt-4 max-w-lg text-sm leading-6 text-zinc-500">
                            Your team has no pod in {live.name} right now. If the organiser seats it in a
                            lucky pod, this page picks that up on its own.
                          </p>
                        </>
                      )}
                    </div>
                  ) : complete ? (
                    <div className="flex flex-1 flex-col justify-center py-4">
                      <Eyebrow tone="neon">Auction finished</Eyebrow>
                      <h2 className="mt-3 text-3xl font-semibold text-white">Every round is settled.</h2>
                      <p className="mt-4 max-w-lg text-sm leading-6 text-zinc-500">
                        Your team&apos;s final product spec is in the Resource Manager.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-1 flex-col justify-center py-4">
                      <Eyebrow tone="amber">Standby</Eyebrow>
                      <h2 className="mt-3 text-3xl font-semibold text-white">
                        Waiting for the organiser to start the auction.
                      </h2>
                      <p className="mt-4 max-w-lg text-sm leading-6 text-zinc-500">
                        {started
                          ? "The next round opens on the organiser's signal."
                          : "The first round opens on the organiser's signal."}{" "}
                        This page changes on its own the moment it does.
                      </p>
                    </div>
                  )}
                </section>

                {/* pod column — the same slot the lead's room uses for the pod,
                    only while the pod is still bidding (see showPodColumn) */}
                {showPodColumn && pod ? <PodColumn pod={pod} youTeamId={team.id} /> : null}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-neon/10 pt-4">
                <p className="text-[0.62rem] text-zinc-600">
                  Only the lead&apos;s account can enter the bidding room.
                </p>
                <Link href="/teams" className={`${ghostButton} h-9 px-4 text-xs`}>
                  Team dashboard
                </Link>
              </div>
            </Panel>
          </div>

          <aside className="flex w-full flex-col gap-4 self-start lg:w-[23%]">
            <ResourceManager
              resources={context.resources}
              capsules={context.capsules}
              identityHint={null}
              showBidCap={false}
            />
          </aside>
        </section>

        <p className="pb-2 text-center text-[0.62rem] text-zinc-700">
          Rounds run one at a time in order · your lead is the only bidder · the ledger updates the
          moment a tier settles
        </p>
      </div>
    </main>
  );
}

/**
 * The pod, as the lead's side column shows it: every team in it and the tier
 * each has taken so far. Sits beside the status, inside the same panel.
 */
function PodColumn({ pod, youTeamId }: { pod: PodSummary; youTeamId: number }) {
  return (
    <section className="flex min-w-0 flex-col lg:w-[39%]">
      <div className="rounded-[20px] border border-neon/20 bg-zinc-950/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[0.65rem] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
            {pod.podLabel} · who has what
          </h4>
          <span className="font-mono text-[0.6rem] text-zinc-500">
            {pod.settledLots} of {pod.lotCount} settled
          </span>
        </div>
        <ul className="mt-3 space-y-1.5">
          {pod.teams.map((row) => {
            const isYou = row.teamId === youTeamId;
            return (
              <li
                key={row.teamId}
                className={`rounded-lg px-2.5 py-1.5 text-xs ${
                  isYou ? "bg-neon/[0.07] text-neon" : "text-zinc-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">
                    {row.teamName}
                    {isYou ? <span className="ml-1.5 text-[0.6rem]">you</span> : null}
                  </span>
                  <span className="shrink-0 truncate font-mono text-[0.6rem] text-zinc-500">
                    {row.leadName}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-[0.62rem]">
                  {row.result ? (
                    <>
                      <span className="min-w-0 truncate text-zinc-400">{row.result.tierName}</span>
                      <span className="shrink-0 font-mono text-neon">
                        <Credits value={row.result.pricePaid} />
                      </span>
                    </>
                  ) : (
                    <span className="text-zinc-600">still bidding</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
