"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronIcon } from "./auction-icon";
import { Badge, ExpandedWorkspace, Shell } from "./expanded-workspace";
import { IdentityBar } from "./identity-bar";
import { MemberView } from "./member-view";
import { ResourceManager } from "./resource-manager";
import { RoundComplete, rowsFromSummary } from "./round-complete";
import { auctionTiles } from "./auction-data";
import { useViewer } from "@/lib/use-viewer";
import { Chip, CornerMarks, Eyebrow, Panel } from "@/components/ui/panel";
import {
  getBiddingContextAction,
  type BiddingContext,
  type CapsuleContext,
  type PodSummary,
} from "./actions";
import { secondsUntil, useAuctionSocket, useSecondTick } from "./use-auction-socket";

/** How often a member's watch view re-reads the database while a round is live. */
const MEMBER_LIVE_POLL_MS = 4_000;
/** Polling between rounds, for everyone who has no room to sit in. */
const IDLE_POLL_MS = 10_000;
const NO_TEAM_MESSAGE = "Join or create a team first to view the bidding page.";

function formatTimerDisplay(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const emptyContext: BiddingContext = {
  status: "success",
  message: "",
  team: null,
  viewerRole: null,
  currentLot: null,
  currentResult: null,
  podSummary: null,
  resources: null,
  capsules: auctionTiles.map((tile, index) => ({
    key: tile.id,
    name: tile.label,
    sequenceOrder: index + 1,
    capsuleId: null,
    status: "PENDING" as const,
    tierCount: tile.items.length,
    podId: null,
    podLabel: null,
    podKind: null,
  })),
};

/**
 * The auction as a team sees it. Organiser controls — starting the event,
 * forcing a round, resetting — live on /admin; nothing here can change the
 * event's state, only bid in it.
 */
export function BiddingClient() {
  const [fetched, setFetched] = useState<{ identity: string; context: BiddingContext }>({
    identity: "",
    context: emptyContext,
  });
  // Exactly one capsule holds the open panel at a time (see `openKey` below).
  // A click folds it; remembering *which* key was folded means a new round —
  // a different key — arrives expanded on its own, and the previous one
  // collapses with it.
  const [collapsedKey, setCollapsedKey] = useState<string | null>(null);

  useSecondTick();

  // ---------------------------------------------------------------- identity

  // The viewer is whoever signed in with Google; the server works out from
  // that email whether they lead their team or merely belong to it.
  const viewer = useViewer();
  const identity = viewer.email || null;

  const refreshContext = useCallback(() => {
    if (!identity) return;
    getBiddingContextAction(identity)
      .then((context) => setFetched({ identity, context }))
      .catch(() => undefined);
  }, [identity]);

  useEffect(() => {
    refreshContext();
  }, [refreshContext]);

  // A context fetched for one identity must not linger once it changes — a
  // sign-out drops straight back to the empty shell.
  const context = identity && fetched.identity === identity ? fetched.context : emptyContext;
  const lookupPending = Boolean(identity && fetched.identity !== identity);
  const needsTeam = Boolean(
    identity &&
      fetched.identity === identity &&
      !context.team &&
      context.message === "No team found for that identity.",
  );

  const teamId = context.team ? String(context.team.id) : null;
  // Only the lead bids (rulebook 8). A member gets the read-only view and
  // never opens a socket — a second seat in the room would count for quorum.
  const isMember = context.viewerRole === "MEMBER";

  // ------------------------------------------------------------------ socket

  // Exactly one capsule runs at a time, so there is exactly one room to be in.
  // The server keeps exactly one capsule live; if it ever reports more, the
  // one furthest along the running order is the current round.
  const liveCapsule = context.capsules.findLast((capsule) => capsule.status === "LIVE") ?? null;
  const activePodId = isMember ? null : (liveCapsule?.podId ?? null);

  // The hub seats the lead's email only.
  const socketEmail = isMember ? null : identity;

  const { connection, state: room, feedback, claimFeedback, clockSkew, placeBid, claimLot, lastEvent } =
    useAuctionSocket(activePodId, teamId, socketEmail);

  // A round ending, or the next one opening, changes which room this client
  // belongs to — so re-read the context whenever the server says so.
  // Settlements land in the Resource Manager, so a closing lot refreshes too.
  useEffect(() => {
    if (!lastEvent) return;
    refreshContext();
  }, [lastEvent, refreshContext]);

  // With no socket there is no push: between rounds nobody has a room, and a
  // member never does. Poll instead — quickly while a member is following a
  // live round, gently otherwise. Once a lead's room is open the socket does
  // the work.
  const isLive = Boolean(liveCapsule);
  useEffect(() => {
    if (!isMember && connection === "open") return;
    const ms = isMember && isLive ? MEMBER_LIVE_POLL_MS : IDLE_POLL_MS;
    const id = setInterval(refreshContext, ms);
    return () => clearInterval(id);
  }, [isMember, isLive, connection, refreshContext]);

  // --------------------------------------------------------------------- ui

  if (isMember) {
    return <MemberView context={context} polling={isLive} />;
  }

  const eventStarted = context.capsules.some((capsule) => capsule.status !== "PENDING");
  const eventComplete =
    eventStarted && context.capsules.every((capsule) => capsule.status === "CLOSED");

  // With nothing live, the round that finished most recently keeps its panel
  // open: its results stay on screen until the organiser opens the next one.
  const finishedCapsule = liveCapsule
    ? null
    : (context.capsules.findLast((capsule) => capsule.status === "CLOSED") ?? null);
  // The next round in the running order — what the organiser opens next.
  const nextCapsule = context.capsules.find((capsule) => capsule.status !== "CLOSED" && capsule.key !== liveCapsule?.key) ?? null;

  // Before the first round a team has nothing to look at but the running
  // order, so it gets the standby panel. Nothing about the auction is shown
  // until the organiser presses Start; the server refuses the room until
  // then too, so this is a courtesy, not the gate.
  const standbyBeforeStart =
    Boolean(teamId) && !lookupPending && !liveCapsule && !finishedCapsule && !eventComplete;

  // Which capsule holds the open panel: the live round, else the one that just
  // finished. When this changes — the organiser started the next round — the
  // old panel collapses and the new one expands, with no click needed.
  const openKey = liveCapsule?.key ?? finishedCapsule?.key ?? null;
  const panelOpen = openKey !== null && collapsedKey !== openKey;
  const togglePanel = () => setCollapsedKey((current) => (current === openKey ? null : openKey));

  const activeLot = room?.lots.find((lot) => lot.status === "OPEN") ?? null;
  const secondsLeft = secondsUntil(activeLot?.closesAt ?? null, clockSkew);

  function workspaceMessage(): string | null {
    if (viewer.loading || lookupPending) {
      return "Loading your team...";
    }
    if (needsTeam) {
      return NO_TEAM_MESSAGE;
    }
    if (!teamId) {
      return "Sign in with your team's email to join its pod room.";
    }
    if (!liveCapsule) {
      return eventComplete
        ? "Every round is finished. Your final product spec is in the Resource Manager."
        : "The auction has not started yet. This page will come alive when the first round opens.";
    }
    if (!liveCapsule.podId) {
      // No seat this round: never drawn into a pod, or taken out of one by
      // the organiser. They can seat the team in a lucky pod that has not
      // started; the page polls, so it changes on its own if they do.
      return `${liveCapsule.name} is running, but your team has no pod in it right now. If the organiser seats you in a lucky pod, this page picks it up on its own — keep it open.`;
    }
    return null;
  }

  const identityLabel = context.team
    ? `${context.team.name} · ${context.team.code}`
    : viewer.loading || lookupPending
      ? "Loading your team..."
      : needsTeam
        ? "Join or create a team first"
        : identity
          ? (context.message || "Team lookup failed")
          : "Not signed in";

  const emptyResourceHint = needsTeam
    ? NO_TEAM_MESSAGE
    : teamId
      ? null
      : "Sign in with your roster email to see what your team owns.";

  return (
    <main className="flex min-h-dvh flex-col overflow-x-hidden bg-black p-4 pt-20 text-zinc-100 sm:p-[3%] sm:pt-24">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4">
        <IdentityBar
          teamLabel={identityLabel}
          podLabel={room?.pod.label ?? liveCapsule?.podLabel ?? context.podSummary?.podLabel ?? null}
          podKind={room?.pod.kind ?? liveCapsule?.podKind ?? context.podSummary?.podKind ?? null}
          connection={connection}
          balance={context.resources?.remaining ?? null}
        />

        {needsTeam ? (
          <section className="rounded-2xl border border-neon/25 bg-neon/[0.04] px-4 py-4 shadow-[0_0_40px_rgba(66,255,90,0.08)] sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div>
              <p className="text-sm font-semibold text-zinc-100">Team required</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">{NO_TEAM_MESSAGE}</p>
            </div>
            <Link
              href="/teams"
              className="mt-3 inline-flex h-9 items-center justify-center rounded-lg border border-neon/40 px-4 font-mono text-[0.62rem] tracking-[0.14em] text-neon uppercase transition hover:bg-neon/10 sm:mt-0"
            >
              Open Teams
            </Link>
          </section>
        ) : null}

        <section className="flex min-h-0 flex-1 flex-col gap-[2.5%] lg:flex-row">
          {standbyBeforeStart ? (
            <div className="flex min-w-0 flex-col gap-4 self-start lg:w-[74%]">
              <WaitingForOrganiser capsules={context.capsules} next={nextCapsule} />
            </div>
          ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-[2%] self-start rounded-[2.5rem] border border-neon/20 bg-black p-[1.5%] shadow-[0_0_80px_rgba(66,255,90,0.06)] lg:w-[74%]">
            <section className="flex min-h-0 flex-1 flex-col gap-[2%] rounded-3xl border border-neon/20 bg-zinc-950/60 p-[2%]">
              {context.capsules.map((capsule) => {
                const isLive = capsule.status === "LIVE";
                const isClosed = capsule.status === "CLOSED";
                // Only the live round — or, with nothing live, the round that
                // just finished — can hold the open panel; every other tile is
                // inert, however its status happens to read.
                const holdsPanel = capsule.key === openKey;
                const isOpen = holdsPanel && panelOpen;
                const tile = auctionTiles.find((t) => t.id === capsule.key);
                const biddable =
                  tile?.items.filter((item) => item.minIncrement !== null).length ?? 0;

                return (
                  <div key={capsule.key} className="flex shrink-0 flex-col">
                    <div
                      className={`flex h-[68px] w-full shrink-0 items-center gap-3 rounded-[20px] border pr-3 pl-5 transition ${
                        isLive
                          ? "border-neon/70 bg-neon/[0.08] shadow-[0_0_24px_rgba(66,255,90,0.15)]"
                          : isClosed
                            ? "border-white/10 bg-black/60"
                            : "border-white/5 bg-black/40"
                      }`}
                    >
                      <span
                        className={`grid size-6 shrink-0 place-items-center rounded-md font-mono text-[0.6rem] ${
                          isLive
                            ? "bg-neon/20 text-neon"
                            : isClosed
                              ? "bg-zinc-800 text-zinc-500"
                              : "bg-zinc-900 text-zinc-700"
                        }`}
                      >
                        {capsule.sequenceOrder}
                      </span>

                      <button
                        type="button"
                        onClick={() => holdsPanel && togglePanel()}
                        disabled={!holdsPanel}
                        aria-expanded={isOpen}
                        className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left font-medium disabled:cursor-default"
                      >
                        <span
                          className={`text-sm tracking-wide uppercase ${
                            isLive ? "text-neon" : isClosed ? "text-zinc-400" : "text-zinc-600"
                          }`}
                        >
                          {capsule.name}
                        </span>

                        {isLive && activeLot ? (
                          <span
                            className={`flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[0.65rem] ${
                              activeLot.awaitingQuorum
                                ? "bg-sky-500/10 text-sky-300"
                                : secondsLeft !== null && secondsLeft <= 10
                                  ? "animate-pulse bg-red-500/15 text-red-400"
                                  : "bg-neon/[0.08] text-neon"
                            }`}
                          >
                            {activeLot.awaitingQuorum
                              ? `waiting ${room?.pod.onlineCount ?? 0}/${room?.pod.quorum ?? 0}`
                              : formatTimerDisplay(secondsLeft ?? 0)}
                          </span>
                        ) : null}

                        <span className="font-mono text-[0.58rem] tracking-[0.14em] text-zinc-600 uppercase">
                          {isClosed
                            ? holdsPanel
                              ? "ended · waiting for the organiser"
                              : "settled"
                            : isLive
                              ? `live · pods of ${capsule.tierCount}`
                              : `locked · ${biddable} bid rounds`}
                        </span>
                      </button>

                      {holdsPanel ? (
                        <button
                          type="button"
                          onClick={togglePanel}
                          aria-label={isOpen ? "Collapse" : "Expand"}
                          className={`shrink-0 px-2 ${isLive ? "text-neon" : "text-zinc-400"}`}
                        >
                          <ChevronIcon open={isOpen} />
                        </button>
                      ) : (
                        <span className="w-9 shrink-0" />
                      )}
                    </div>

                    <div
                      className={`grid transition-all duration-300 ease-in-out ${
                        isOpen ? "mt-[1%] grid-rows-[1fr]" : "grid-rows-[0fr]"
                      }`}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div className="mx-auto w-[96%]">
                          {isOpen && isLive ? (
                            <ExpandedWorkspace
                              capsuleName={capsule.name}
                              room={room}
                              connection={connection}
                              clockSkew={clockSkew}
                              feedback={feedback}
                              claimFeedback={claimFeedback}
                              notStartedMessage={workspaceMessage()}
                              nextCapsuleName={nextCapsule?.name ?? null}
                              onBid={placeBid}
                              onClaim={claimLot}
                            />
                          ) : isOpen ? (
                            <FinishedRound
                              capsule={capsule}
                              summary={context.podSummary}
                              youTeamId={context.team?.id ?? null}
                              nextCapsuleName={nextCapsule?.name ?? null}
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {!liveCapsule && !finishedCapsule ? (
                <p className="px-2 py-4 text-center text-xs leading-5 text-zinc-600">
                  {workspaceMessage()}
                </p>
              ) : null}
            </section>
          </div>
          )}

          <aside className="flex w-full flex-col gap-4 self-start lg:w-[23%]">
            <ResourceManager
              resources={context.resources}
              capsules={context.capsules}
              identityHint={emptyResourceHint}
            />
          </aside>
        </section>

        <p className="pb-2 text-center text-[0.62rem] text-zinc-700">
          Rounds run one at a time in order · pods are prepared at event start · all bids validated
          and recorded server-side
        </p>
      </div>
    </main>
  );
}

/**
 * The panel a finished round keeps open until the organiser starts the next
 * one. The room is gone by now (a socket only exists for a live round), so
 * this is drawn from the context's pod summary — the same settlements rows.
 */
function FinishedRound({
  capsule,
  summary,
  youTeamId,
  nextCapsuleName,
}: {
  capsule: CapsuleContext;
  summary: PodSummary | null;
  youTeamId: number | null;
  nextCapsuleName: string | null;
}) {
  const forThisRound = summary && summary.capsuleKey === capsule.key ? summary : null;

  return (
    <Shell capsuleName={capsule.name} right={<Badge>Ended</Badge>}>
      <div className="flex min-w-0 flex-1 flex-col px-[4%] pt-6 pb-6">
        {forThisRound ? (
          <RoundComplete
            capsuleName={capsule.name}
            podLabel={forThisRound.podLabel}
            rows={rowsFromSummary(forThisRound)}
            youTeamId={youTeamId}
            capsuleClosed
            nextCapsuleName={nextCapsuleName}
          />
        ) : (
          <div className="flex flex-1 flex-col justify-center text-center">
            <p className="text-sm text-zinc-500">
              {capsule.name} has ended. Your team was not seated in a pod for it.
            </p>
            <p className="mt-2 text-xs text-zinc-600">
              {nextCapsuleName
                ? `Waiting for the organiser to start ${nextCapsuleName}.`
                : "That was the last round."}
            </p>
          </div>
        )}
      </div>
    </Shell>
  );
}

/**
 * The bidding page on standby. A team sees this from the moment it exists
 * until the organiser presses Start on the first round.
 * No tiers, no pod, no clock — only the running order and where it has got
 * to. The page polls in this state, so it moves on by itself the moment the
 * organiser acts.
 */
function WaitingForOrganiser({
  capsules,
  next,
}: {
  capsules: CapsuleContext[];
  next: CapsuleContext | null;
}) {
  const betweenRounds = capsules.some((capsule) => capsule.status === "CLOSED");

  return (
    <Panel className="relative flex min-h-[420px] flex-col p-6 sm:p-8">
      <CornerMarks />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Eyebrow tone="amber">Standby</Eyebrow>
        <Chip tone="amber">
          <span className="size-1.5 animate-pulse rounded-full bg-amber-400" aria-hidden />
          Waiting for the organiser
        </Chip>
      </div>

      <div className="flex flex-1 flex-col justify-center py-8">
        <h2 className="text-3xl font-semibold tracking-wide text-white sm:text-4xl">
          Waiting for the organiser to start the auction.
        </h2>
        <p className="mt-4 max-w-lg text-sm leading-6 text-zinc-400">
          {next ? (
            <>
              {betweenRounds ? "The next round, " : "The first round, "}
              <span className="text-zinc-100">
                Round {next.sequenceOrder} · {next.name}
              </span>
              , opens on the organiser&apos;s signal. Your pod, its tiers and the clock appear here
              the moment it does — keep this page open; it changes on its own.
            </>
          ) : (
            "The next round opens on the organiser's signal. Keep this page open; it changes on its own."
          )}
        </p>
      </div>

      <div className="border-t border-neon/10 pt-4">
        <Eyebrow>Running order</Eyebrow>
        <ol className="mt-2 grid gap-2 sm:grid-cols-4">
          {capsules.map((capsule) => {
            const isClosed = capsule.status === "CLOSED";
            const isNext = capsule.key === next?.key;
            return (
              <li
                key={capsule.key}
                className={`rounded-xl border px-3 py-2.5 ${
                  isNext
                    ? "border-amber-500/40 bg-amber-500/[0.05]"
                    : isClosed
                      ? "border-white/10 bg-black/60"
                      : "border-white/5 bg-black/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded font-mono text-[0.55rem] ${
                      isNext
                        ? "bg-amber-500/20 text-amber-300"
                        : isClosed
                          ? "bg-zinc-800 text-zinc-500"
                          : "bg-zinc-900 text-zinc-700"
                    }`}
                  >
                    {capsule.sequenceOrder}
                  </span>
                  <span
                    className={`truncate text-xs tracking-wide uppercase ${
                      isNext ? "text-amber-200" : isClosed ? "text-zinc-400" : "text-zinc-600"
                    }`}
                  >
                    {capsule.name}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[0.55rem] tracking-[0.12em] text-zinc-600 uppercase">
                  {isClosed ? "settled" : isNext ? "up next · waiting" : "locked"}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </Panel>
  );
}
