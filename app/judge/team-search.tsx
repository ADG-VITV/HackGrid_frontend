"use client";

import { Chip, Eyebrow, Panel, inputField } from "@/components/ui/panel";
import type { JudgeSearchResult } from "./actions";

/** Find a team to review: by name, code, or any member's name or email. */
export function TeamSearch({
  query,
  onQueryChange,
  result,
  pending,
  maxTotal,
  onSelect,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  result: JudgeSearchResult;
  pending: boolean;
  maxTotal: number;
  onSelect: (teamId: number) => void;
}) {
  const scored = result.teams.filter((team) => team.reviewedScore !== null).length;

  return (
    <Panel className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Eyebrow tone="neon">Find a team</Eyebrow>
        {result.teams.length ? (
          <Chip tone="muted">
            {scored} of {result.teams.length} scored
          </Chip>
        ) : null}
      </div>
      <input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search by team name, HG- code, or a member…"
        autoComplete="off"
        className={`${inputField} mt-3 h-12`}
      />

      {result.status === "error" ? (
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {result.message}
        </p>
      ) : null}

      <ul className={`mt-4 grid gap-2 sm:grid-cols-2 ${pending ? "opacity-60" : ""}`}>
        {result.teams.map((team) => (
          <li key={team.id}>
            <button
              type="button"
              onClick={() => onSelect(team.id)}
              className="group flex w-full flex-col gap-1.5 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-left transition hover:border-neon/50 hover:bg-neon/[0.04]"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-semibold text-zinc-100 group-hover:text-neon">
                  {team.name}
                </span>
                {team.reviewedScore !== null ? (
                  <span className="shrink-0 font-mono text-xs font-semibold text-neon">
                    {team.reviewedScore}/{maxTotal}
                  </span>
                ) : (
                  <span className="shrink-0 font-mono text-[0.6rem] tracking-[0.12em] text-zinc-600 uppercase">
                    not scored
                  </span>
                )}
              </span>
              <span className="font-mono text-[0.62rem] text-zinc-500">
                {team.code} · lead {team.leaderName}
              </span>
              <span className="truncate text-xs text-zinc-500">{team.memberNames.join(", ")}</span>
            </button>
          </li>
        ))}
      </ul>

      {result.status === "success" && result.teams.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No team matches that.</p>
      ) : null}
    </Panel>
  );
}
