"use client";

import { Chip, CornerMarks, Eyebrow, Panel, ghostButton, inputField, primaryButton } from "@/components/ui/panel";

export type EntranceView =
  | { view: "signed_out" }
  | { view: "apply" }
  | { view: "pending"; message: string }
  | { view: "denied"; message: string }
  | { view: "active"; judgeName: string };

/**
 * The strip above the judge portal that says where this person stands: sign
 * in, enter the invitation code, wait for the organiser, refused — or, once
 * approved, a slim "judge online" bar.
 */
export function JudgeEntrance({
  view,
  email,
  code,
  pending,
  message,
  onCodeChange,
  onApply,
  onSignIn,
  onSignOut,
}: {
  view: EntranceView;
  email: string | null;
  code: string;
  pending: boolean;
  message: { tone: "ok" | "error"; text: string } | null;
  onCodeChange: (code: string) => void;
  onApply: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  if (view.view === "active") {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-neon/20 bg-zinc-950/60 px-4 py-3">
        <Chip tone="neon">
          <span className="size-1.5 rounded-full bg-neon shadow-[0_0_10px_rgba(66,255,90,0.7)]" aria-hidden />
          Judge online
        </Chip>
        <span className="text-sm text-zinc-300">{view.judgeName}</span>
        <span className="font-mono text-[0.65rem] text-zinc-500">{email}</span>
        <button type="button" onClick={onSignOut} className={`${ghostButton} ml-auto h-9 px-4 text-xs`}>
          Sign out
        </button>
      </div>
    );
  }

  if (view.view === "signed_out") {
    return (
      <Panel className="relative p-6 sm:p-8">
        <CornerMarks />
        <Eyebrow tone="neon">Judge portal</Eyebrow>
        <h2 className="mt-2 text-2xl font-semibold text-white">Sign in to review teams.</h2>
        <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-500">
          Continue with Google, then enter the invitation code the organisers gave you. An organiser
          approves you before you can score anything.
        </p>
        <button type="button" onClick={onSignIn} disabled={pending} className={`${primaryButton} mt-5`}>
          {pending ? "Signing in…" : "Continue with Google"}
          <span aria-hidden>→</span>
        </button>
        {message ? <Notice message={message} /> : null}
      </Panel>
    );
  }

  if (view.view === "pending" || view.view === "denied") {
    const isPending = view.view === "pending";
    return (
      <Panel tone="amber" className="relative p-6 sm:p-8">
        <CornerMarks />
        <Eyebrow tone="amber">{isPending ? "Application pending" : "Access denied"}</Eyebrow>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          {isPending ? "Waiting for an organiser." : "You cannot judge this event."}
        </h2>
        <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-300">{view.message}</p>
        <p className="mt-1 font-mono text-[0.65rem] text-zinc-500">{email}</p>
        <button type="button" onClick={onSignOut} className={`${ghostButton} mt-5`}>
          Switch account
        </button>
      </Panel>
    );
  }

  // apply: signed in, no application yet
  return (
    <Panel className="relative p-6 sm:p-8">
      <CornerMarks />
      <Eyebrow tone="neon">Invitation code</Eyebrow>
      <h2 className="mt-2 text-2xl font-semibold text-white">Apply to judge.</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-500">
        Signed in as <span className="font-mono text-zinc-200">{email}</span>. Enter the code the
        organisers shared; they will approve your application on their side.
      </p>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          onApply();
        }}
      >
        <input
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          placeholder="Invitation code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className={`${inputField} mt-0 font-mono tracking-[0.14em] uppercase`}
        />
        <button type="submit" disabled={pending || !code.trim()} className={primaryButton}>
          {pending ? "Sending…" : "Apply"}
        </button>
      </form>
      {message ? <Notice message={message} /> : null}
      <button
        type="button"
        onClick={onSignOut}
        className="mt-4 text-xs font-semibold tracking-wide text-zinc-600 uppercase transition hover:text-zinc-300"
      >
        Use a different account
      </button>
    </Panel>
  );
}

function Notice({ message }: { message: { tone: "ok" | "error"; text: string } }) {
  return (
    <p
      className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
        message.tone === "ok"
          ? "border-neon/30 bg-neon/10 text-neon"
          : "border-red-500/30 bg-red-500/10 text-red-200"
      }`}
      aria-live="polite"
    >
      {message.text}
    </p>
  );
}
