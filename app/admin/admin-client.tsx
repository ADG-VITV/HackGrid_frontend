"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  addTeamToPodAction,
  createManualPodAction,
  deleteManualPodAction,
  getAdminContextAction,
  removeTeamFromPodAction,
  resetCapsuleAction,
  resetEventAdminAction,
  resetPodAction,
  resetSubCapsuleAction,
  setPodRemainderFlagAction,
  startEventAdminAction,
  startPodAction,
  startRoundAction,
  type AdminContext,
  type AdminReport,
} from "./actions";
import { JudgesPanel } from "./judges-panel";

function statusTone(status: string) {
  return status === "LIVE"
    ? "border-neon/50 text-neon"
    : status === "CLOSED"
      ? "border-zinc-700 text-zinc-400"
      : "border-amber-500/40 text-amber-300";
}

function podStatusTone(status: string) {
  return status === "LIVE"
    ? "border-neon/50 bg-neon/10 text-neon"
    : status === "COMPLETE"
      ? "border-zinc-700 bg-zinc-900 text-zinc-400"
      : status === "WAITING_FOR_TEAMS"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
        : "border-zinc-700 text-zinc-400";
}

function podStatusLabel(status: string) {
  return status === "WAITING_FOR_TEAMS" ? "WAITING FOR TEAMS" : status;
}

type AdminCapsule = AdminContext["capsules"][number];

/**
 * The "free" space for the live round: teams with no seat in any of its pods
 * — either never drawn into one, or taken out of one by the organiser because
 * their lead was absent. They can be seated in a lucky pod that has not
 * started (the picker sits on that pod). If none is left, they sit this
 * round out and join the next as normal.
 */
function UnseatedPanel({ teams, capsule }: { teams: AdminContext["teams"]; capsule: AdminCapsule }) {
  const seated = new Set(capsule.pods.flatMap((pod) => pod.teams.map((team) => team.id)));
  const unseated = teams.filter((team) => !seated.has(team.id));
  if (unseated.length === 0) return null;

  const heldLucky = capsule.pods.filter(
    (pod) => pod.kind === "REMAINDER" && pod.auctionStatus === "PENDING" && pod.teams.length < capsule.subCapsules.length,
  );

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-amber-200">
          Unseated this round · {unseated.length}
        </p>
        <span className="text-xs text-zinc-500">
          {heldLucky.length
            ? `Seat them from a held lucky pod below (${heldLucky.map((pod) => pod.label).join(", ")}).`
            : "No lucky pod is open for seating — reset one to hold it, or create a lucky pod in the manager below."}
        </span>
      </div>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {unseated.map((team) => (
          <li key={team.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs">
            <span className="size-1.5 shrink-0 rounded-full bg-zinc-700" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-zinc-200">{team.name}</span>
            <span className="shrink-0 font-mono text-[0.62rem] text-zinc-500">{team.code}</span>
            <span className="shrink-0 truncate text-[0.62rem] text-zinc-500">{team.leadName}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminClient() {
  const [context, setContext] = useState<AdminContext | null>(null);
  const [message, setMessage] = useState<AdminReport | null>(null);
  const [pending, startTransition] = useTransition();
  const [managedRoundKey, setManagedRoundKey] = useState("");
  const [managedPodNumber, setManagedPodNumber] = useState("");
  const [newPodIsRemainder, setNewPodIsRemainder] = useState(false);
  const [teamToAdd, setTeamToAdd] = useState("");
  /** podId -> team id chosen in that lucky pod's "seat a team" picker (live round). */
  const [seatPick, setSeatPick] = useState<Record<string, string>>({});

  const reload = useCallback(() => {
    void getAdminContextAction()
      .then(setContext)
      .catch(() => setMessage({ status: "error", message: "Could not load organiser state." }));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // No socket on this page, so team presence would otherwise only move on a
  // manual Refresh. Poll at the same gentle cadence the bidding page uses
  // between rounds.
  useEffect(() => {
    const id = setInterval(reload, 10_000);
    return () => clearInterval(id);
  }, [reload]);

  function run(action: () => Promise<AdminReport>) {
    startTransition(async () => {
      const report = await action();
      setMessage(report);
      reload();
    });
  }

  const liveCapsule = context?.event.liveCapsuleName ?? null;
  const eventPrepared = context?.event.isPrepared ?? false;
  const canStartEvent = Boolean(context) && !eventPrepared && !liveCapsule;
  const managedCapsule = context?.capsules.find((capsule) => capsule.key === managedRoundKey) ?? null;
  const normalizedPodNumber = managedPodNumber.trim();
  const parsedPodNumber = /^\d+$/.test(normalizedPodNumber) ? Number(normalizedPodNumber) : Number.NaN;
  const hasValidPodNumber = Number.isSafeInteger(parsedPodNumber) && parsedPodNumber > 0;
  const managedPod =
    managedCapsule && hasValidPodNumber
      ? managedCapsule.pods.find((pod) => pod.label === `Pod ${parsedPodNumber}`) ?? null
      : null;
  const seatedTeamIds = new Set(managedCapsule?.pods.flatMap((pod) => pod.teams.map((team) => team.id)) ?? []);
  const unseatedTeams = context?.teams.filter((team) => !seatedTeamIds.has(team.id)) ?? [];

  return (
    <main className="min-h-dvh bg-black px-4 pt-24 pb-12 text-zinc-100 sm:px-[6%]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-400">
              Organiser portal
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Event control</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Nothing happens until you act. <span className="text-zinc-200">Start event</span> draws
              the pods for all four rounds — teams still see &ldquo;waiting for the organiser&rdquo;.{" "}
              <span className="text-zinc-200">Start round</span> on a round is the signal: that is the
              moment its pods open on every team&apos;s bidding page and the tier clocks can begin.
              Rounds open strictly in order; each can be reset without touching the others.
            </p>
          </div>
          <button
            type="button"
            onClick={reload}
            disabled={pending}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-300 hover:border-neon/50 hover:text-neon disabled:opacity-40"
          >
            Refresh
          </button>
        </div>

        {message ? (
          <p
            className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
              message.status === "error"
                ? "border-red-500/40 bg-red-500/10 text-red-200"
                : "border-neon/35 bg-neon/10 text-neon"
            }`}
          >
            {message.message}
          </p>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-zinc-950 p-5">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Teams onboarded</p>
            <p className="mt-2 text-3xl font-semibold text-white">{context?.teamCount ?? "-"}</p>
            <p className="mt-2 text-xs text-zinc-500">All prepared rounds reuse this roster.</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-zinc-950 p-5">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Rounds prepared</p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {context ? `${context.event.preparedCapsules}/${context.capsules.length}` : "-"}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Starting the event locks pod assignments for every round.
            </p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-zinc-950 p-5">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Live round</p>
            <p className="mt-2 text-sm font-medium text-white">{liveCapsule ?? "No round live"}</p>
            <p className="mt-2 text-xs text-zinc-500">
              {context
                ? `${context.event.completedCapsules} completed · starting budget ${context.event.startingBudget}`
                : "Waiting for event context."}
            </p>
          </article>
        </section>

        <section className="mt-5 flex flex-wrap gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] p-4">
          <button
            type="button"
            onClick={() => run(startEventAdminAction)}
            disabled={pending || !canStartEvent}
            className="rounded-lg border border-neon/60 bg-neon/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neon hover:bg-neon/20 disabled:opacity-40"
          >
            Start event
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Reset the whole event? All bids and settlements will be removed.")) {
                run(resetEventAdminAction);
              }
            }}
            disabled={pending}
            className="rounded-lg border border-red-500/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-red-300 hover:bg-red-500/10 disabled:opacity-40"
          >
            Reset event
          </button>
        </section>

        <JudgesPanel judging={context?.judging ?? null} pending={pending} run={run} />

        <section className="mt-8 space-y-4">
          {context?.capsules.map((capsule) => (
            <article key={capsule.key} className="rounded-2xl border border-white/10 bg-zinc-950 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-xs text-zinc-500">ROUND {capsule.sequenceOrder}</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">{capsule.name}</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {capsule.podCount} prepared pods · {capsule.memberCount} seats ·{" "}
                    {capsule.settlementCount} settled lots
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(capsule.status)}`}>
                    {capsule.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => run(() => startRoundAction(capsule.key))}
                    disabled={
                      pending ||
                      capsule.status !== "PENDING" ||
                      !eventPrepared ||
                      Boolean(liveCapsule)
                    }
                    className="rounded-lg border border-neon/50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neon hover:bg-neon/10 disabled:opacity-40"
                  >
                    Start round
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Reset ${capsule.name}? Its bids and results will be removed, but its prepared pods remain.`,
                        )
                      ) {
                        run(() => resetCapsuleAction(capsule.key));
                      }
                    }}
                    disabled={pending || capsule.podCount === 0}
                    className="rounded-lg border border-red-500/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                  >
                    Reset round
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-4">
                {capsule.subCapsules.map((subCapsule) => (
                  <button
                    key={subCapsule.key}
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Reset ${subCapsule.name}? Earlier tiers stay settled and this tier reopens cleanly.`,
                        )
                      ) {
                        run(() => resetSubCapsuleAction(capsule.key, subCapsule.key));
                      }
                    }}
                    disabled={pending || capsule.podCount === 0}
                    className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-amber-400/60 hover:text-amber-200 disabled:opacity-40"
                  >
                    Reset tier {subCapsule.tierRank}: {subCapsule.name}
                  </button>
                ))}
              </div>

              <details className="group mt-4 border-t border-white/5 pt-4">
                <summary className="cursor-pointer list-none text-sm font-medium text-zinc-200 marker:hidden">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-neon transition-transform group-open:rotate-90">›</span>
                    View pods and auction status
                  </span>
                </summary>
                <div className="mt-3 space-y-3">
                  {capsule.status === "LIVE" ? (
                    <UnseatedPanel
                      teams={context?.teams ?? []}
                      capsule={capsule}
                    />
                  ) : null}
                  {capsule.pods.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-zinc-800 px-3 py-3 text-xs text-zinc-500">
                      Pods will appear here after the event is prepared.
                    </p>
                  ) : (
                    capsule.pods.map((pod) => (
                      <details key={pod.label} className="group/pod rounded-xl border border-white/10 bg-black/30 p-4">
                        <summary className="cursor-pointer list-none marker:hidden">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {pod.label}
                                {pod.kind === "REMAINDER" ? (
                                  <span className="font-normal text-amber-300/80"> · lucky / remainder</span>
                                ) : null}
                              </p>
                              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-500">
                                <span
                                  className={`size-1.5 shrink-0 rounded-full ${
                                    pod.onlineCount > 0 ? "bg-neon" : "bg-zinc-700"
                                  }`}
                                  aria-hidden
                                />
                                <span className={pod.onlineCount > 0 ? "text-neon" : undefined}>
                                  {pod.onlineCount} of {pod.teams.length} online
                                </span>
                                <span>·</span>
                                <span>
                                  {pod.activeItemName
                                    ? `Auctioning: ${pod.activeItemName}`
                                    : `${pod.settledLots}/${pod.lotCount} lots settled`}
                                </span>
                              </p>
                            </div>
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${podStatusTone(pod.auctionStatus)}`}>
                              {podStatusLabel(pod.auctionStatus)}
                            </span>
                          </div>
                        </summary>
                        {(() => {
                          // Live-round roster tools. A team can be taken out of a pod
                          // only while that pod has sold nothing (a main pod then
                          // becomes a lucky pod; a lucky pod that has not started just
                          // shrinks). A lucky pod that is still held — every tier
                          // pending — can take an unseated team and be started once the
                          // main pods are done.
                          const isLive = capsule.status === "LIVE";
                          const isLucky = pod.kind === "REMAINDER";
                          const soldSomething = pod.teams.some((team) => team.item);
                          const luckyHeld = isLucky && pod.auctionStatus === "PENDING";
                          const canRelease = isLive && !soldSomething && (!isLucky || luckyHeld);
                          const unseatedHere = context?.teams.filter(
                            (team) => !capsule.pods.some((p) => p.teams.some((t) => t.id === team.id)),
                          ) ?? [];
                          const hasRoom = pod.teams.length < capsule.subCapsules.length;
                          const mainPodsDone = capsule.pods
                            .filter((p) => p.kind === "MAIN")
                            .every((p) => p.auctionStatus === "COMPLETE");
                          const picked = seatPick[pod.id] ?? "";
                          return (
                            <>
                              {isLive && luckyHeld ? (
                                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.04] px-3 py-2">
                                  <span className="text-xs text-amber-200/90">
                                    Held lucky pod · {pod.teams.length} seated
                                    {!mainPodsDone ? " · opens when the main pods finish, or by hand after" : ""}
                                  </span>
                                  <select
                                    value={picked}
                                    onChange={(event) => setSeatPick((prev) => ({ ...prev, [pod.id]: event.target.value }))}
                                    disabled={pending || !hasRoom || unseatedHere.length === 0}
                                    className="ml-auto rounded-md border border-zinc-700 bg-black px-2 py-1.5 text-xs text-white outline-none focus:border-neon disabled:opacity-40"
                                  >
                                    <option value="">
                                      {!hasRoom
                                        ? "Pod is full"
                                        : unseatedHere.length
                                          ? "Seat an unseated team…"
                                          : "No unseated teams"}
                                    </option>
                                    {unseatedHere.map((team) => (
                                      <option key={team.id} value={team.id}>
                                        {team.name} ({team.code})
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const teamId = Number.parseInt(picked, 10);
                                      if (!Number.isInteger(teamId)) return;
                                      setSeatPick((prev) => ({ ...prev, [pod.id]: "" }));
                                      run(() => addTeamToPodAction(capsule.key, pod.id, teamId));
                                    }}
                                    disabled={pending || !picked || !hasRoom}
                                    className="rounded-md border border-neon/50 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-neon hover:bg-neon/10 disabled:opacity-40"
                                  >
                                    Seat
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => run(() => startPodAction(capsule.key, pod.id))}
                                    disabled={pending || pod.teams.length === 0 || !mainPodsDone}
                                    title={
                                      !mainPodsDone
                                        ? "Lucky pods are priced from the main pods' results, so they start once every main pod has finished."
                                        : undefined
                                    }
                                    className="rounded-md border border-neon/60 bg-neon/10 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-neon hover:bg-neon/20 disabled:opacity-40"
                                  >
                                    Start lucky pod
                                  </button>
                                </div>
                              ) : null}

                              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                                {isLive && !canRelease ? (
                                  <span className="mr-auto text-xs text-zinc-600">
                                    {soldSomething
                                      ? "Teams can be moved only before the pod sells a tier — reset the pod first."
                                      : "Reset this lucky pod to hold it before changing its teams."}
                                  </span>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        isLucky
                                          ? `Reset ${pod.label}? Its bids and won items will be removed and the pod is held — change its teams, then press Start on it.`
                                          : `Reset ${pod.label}? Its bids and won items will be removed, then it will restart from the first item.`,
                                      )
                                    ) {
                                      run(() => resetPodAction(capsule.key, pod.id));
                                    }
                                  }}
                                  disabled={pending || capsule.status !== "LIVE"}
                                  className="rounded-md border border-red-500/40 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                                >
                                  Reset pod
                                </button>
                              </div>
                            </>
                          );
                        })()}
                        <div className="mt-4 overflow-x-auto border-t border-white/5 pt-3">
                          <table className="w-full min-w-[44rem] text-left text-xs">
                            <thead className="text-zinc-500">
                              <tr>
                                <th className="pb-2 pr-3 font-medium">Seat</th>
                                <th className="pb-2 pr-3 font-medium">Team</th>
                                <th className="pb-2 pr-3 font-medium">Code</th>
                                <th className="pb-2 pr-3 font-medium">Team leader</th>
                                <th className="pb-2 pr-3 font-medium">Round item</th>
                                {capsule.status === "LIVE" ? <th className="pb-2 font-medium"></th> : null}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-zinc-300">
                              {pod.teams.map((team) => (
                                <tr key={team.id}>
                                  <td className="py-2.5 pr-3 font-mono text-zinc-500">{team.seat}</td>
                                  <td className="py-2.5 pr-3 font-medium text-white">
                                    <span className="flex items-center gap-2">
                                      <span
                                        className={`size-1.5 shrink-0 rounded-full ${
                                          team.online ? "bg-neon" : "bg-zinc-700"
                                        }`}
                                        aria-label={team.online ? "online" : "offline"}
                                      />
                                      <span>{team.name}</span>
                                    </span>
                                  </td>
                                  <td className="py-2.5 pr-3 font-mono text-zinc-500">{team.code}</td>
                                  <td className="py-2.5 pr-3">
                                    <span className="block text-zinc-200">{team.leadName}</span>
                                    <span className="block font-mono text-[0.65rem] text-zinc-500">
                                      {team.leadEmail}
                                    </span>
                                  </td>
                                  <td className="py-2.5 pr-3">
                                    {team.item ? (
                                      <span>
                                        {team.item.name}
                                        <span className="ml-1 text-zinc-500">· {team.item.pricePaid} credits</span>
                                      </span>
                                    ) : (
                                      <span className="text-zinc-600">No item yet</span>
                                    )}
                                  </td>
                                  {capsule.status === "LIVE" ? (
                                    <td className="py-2.5 text-right">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const toLucky = pod.kind === "MAIN";
                                          if (
                                            window.confirm(
                                              `Take ${team.name} out of ${pod.label}? They are unseated for ${capsule.name}` +
                                                (toLucky
                                                  ? ` and ${pod.label} becomes a lucky pod of ${pod.teams.length - 1}, opening with the other lucky pods once the main pods finish.`
                                                  : pod.teams.length === 1
                                                    ? ` and ${pod.label} is left empty; its tiers are withdrawn.`
                                                    : "."),
                                            )
                                          ) {
                                            run(() => removeTeamFromPodAction(capsule.key, pod.id, team.id));
                                          }
                                        }}
                                        disabled={
                                          pending ||
                                          pod.teams.some((t) => t.item) ||
                                          (pod.kind === "REMAINDER" && pod.auctionStatus !== "PENDING")
                                        }
                                        title={team.online ? "This lead is online right now" : "This lead has no socket in the room"}
                                        className="rounded-md border border-red-500/40 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-red-300 hover:bg-red-500/10 disabled:opacity-30"
                                      >
                                        Remove
                                      </button>
                                    </td>
                                  ) : null}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    ))
                  )}
                </div>
              </details>
            </article>
          ))}
        </section>

        <section className="mt-10 rounded-2xl border border-amber-500/25 bg-zinc-950 p-5 shadow-[0_0_40px_rgba(251,191,36,0.04)]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-400">Manual pod manager</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Find or create a pod</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Select a round and enter a pod number. You can change a pending round&apos;s roster or lucky / remainder attribute before bidding starts.
            </p>
          </div>

          <div className="mt-5 grid gap-3 rounded-xl border border-white/10 bg-black/25 p-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <label className="grid gap-1.5 text-xs font-medium text-zinc-400">
              Round
              <select
                value={managedRoundKey}
                onChange={(event) => setManagedRoundKey(event.target.value)}
                className="rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neon"
              >
                <option value="">Select a round</option>
                {context?.capsules.map((capsule) => (
                  <option key={capsule.key} value={capsule.key}>
                    Round {capsule.sequenceOrder}: {capsule.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-zinc-400">
              Pod number
              <input
                inputMode="numeric"
                min="1"
                value={managedPodNumber}
                onChange={(event) => setManagedPodNumber(event.target.value)}
                placeholder="e.g. 13"
                className="w-full min-w-0 rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-neon"
              />
            </label>
          </div>

          {!managedCapsule || !hasValidPodNumber ? (
            <p className="mt-4 text-xs text-zinc-500">Enter a numbered pod to manage it. Lucky / remainder is an attribute, not a pod name.</p>
          ) : managedPod ? (
            <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">{managedPod.label}</h3>
                    <span className={`rounded-full border px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-wide ${
                      managedPod.kind === "REMAINDER"
                        ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                        : "border-zinc-700 text-zinc-400"
                    }`}>
                      {managedPod.kind === "REMAINDER" ? "lucky / remainder" : "standard pod"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Round {managedCapsule.sequenceOrder} · {managedPod.teams.length} seated team(s) · {managedCapsule.status.toLowerCase()} round
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => run(() => setPodRemainderFlagAction(managedCapsule.key, managedPod.id, managedPod.kind !== "REMAINDER"))}
                    disabled={pending || managedCapsule.status !== "PENDING"}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide disabled:opacity-40 ${
                      managedPod.kind === "REMAINDER"
                        ? "border-amber-400/60 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20"
                        : "border-zinc-700 text-zinc-300 hover:border-amber-400/60 hover:text-amber-200"
                    }`}
                  >
                    {managedPod.kind === "REMAINDER" ? "Unflag remainder" : "Flag remainder"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete ${managedPod.label}? Its ${managedPod.teams.length} seat(s) and pending lots will be removed. Teams will remain available to assign elsewhere.`,
                        )
                      ) {
                        run(() => deleteManualPodAction(managedCapsule.key, managedPod.id));
                      }
                    }}
                    disabled={pending || managedCapsule.status !== "PENDING"}
                    className="rounded-lg border border-red-500/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                  >
                    Delete pod
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                <select
                  value={teamToAdd}
                  onChange={(event) => setTeamToAdd(event.target.value)}
                  disabled={pending || managedCapsule.status !== "PENDING" || unseatedTeams.length === 0}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-neon disabled:opacity-40"
                >
                  <option value="">{unseatedTeams.length ? "Choose an unseated team" : "No unseated teams"}</option>
                  {unseatedTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} ({team.code})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const teamId = Number.parseInt(teamToAdd, 10);
                    if (Number.isInteger(teamId)) run(() => addTeamToPodAction(managedCapsule.key, managedPod.id, teamId));
                  }}
                  disabled={pending || managedCapsule.status !== "PENDING" || !teamToAdd}
                  className="rounded-lg border border-neon/50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neon hover:bg-neon/10 disabled:opacity-40"
                >
                  Add team
                </button>
              </div>

              <ul className="mt-5 divide-y divide-white/5 border-t border-white/10">
                {managedPod.teams.length === 0 ? (
                  <li className="py-3 text-sm text-zinc-500">No teams have been added to this pod.</li>
                ) : (
                  managedPod.teams.map((team) => (
                    <li key={team.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-medium text-white">{team.name}</p>
                        <p className="font-mono text-xs text-zinc-500">{team.code} · seat {team.seat}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => run(() => removeTeamFromPodAction(managedCapsule.key, managedPod.id, team.id))}
                        disabled={pending || managedCapsule.status !== "PENDING"}
                        className="rounded-md border border-red-500/40 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-zinc-700 bg-black/20 p-4">
              <p className="text-sm font-medium text-zinc-200">Pod {parsedPodNumber} does not exist in {managedCapsule.name}.</p>
              <p className="mt-1 text-xs text-zinc-500">
                {managedCapsule.status === "LIVE"
                  ? "The round is live, so this can only be a lucky / remainder pod. It is held until you seat teams in it and press Start."
                  : "Create it as a standard pod, or mark it as a lucky / remainder pod. A round may have more than one."}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={managedCapsule.status === "LIVE" ? true : newPodIsRemainder}
                    disabled={managedCapsule.status === "LIVE"}
                    onChange={(event) => setNewPodIsRemainder(event.target.checked)}
                    className="accent-amber-400"
                  />
                  Flag as lucky / remainder pod
                </label>
                <button
                  type="button"
                  onClick={() =>
                    run(() =>
                      createManualPodAction(
                        managedCapsule.key,
                        parsedPodNumber,
                        managedCapsule.status === "LIVE" ? true : newPodIsRemainder,
                      ),
                    )
                  }
                  disabled={pending || managedCapsule.status === "CLOSED"}
                  className="rounded-lg border border-neon/50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neon hover:bg-neon/10 disabled:opacity-40"
                >
                  Create pod {parsedPodNumber}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
