"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { CornerMarks, Eyebrow, Panel, ghostButton, inputField, primaryButton } from "@/components/ui/panel";
import { verifyResultsAccessAction } from "./actions";
import { idTokenFor, writeResultsKey } from "./judge-session";

/**
 * The gate in front of /judge/evaluations. The judge re-enters their name
 * and the invitation code; the backend checks both against the verified
 * Google identity — a judge profile with an active assignment. Someone
 * signed in without a profile (never applied, pending, or rejected) is
 * refused whatever they type.
 */
export function ResultsAccessDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const token = await idTokenFor(user);
      const report = await verifyResultsAccessAction(token, { name: name.trim(), code: code.trim() });
      if (report.status !== "success") {
        setError(report.message);
        return;
      }
      writeResultsKey(code.trim());
      router.push("/judge/evaluations");
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-md" onClick={onClose}>
      <Panel
        className="relative w-full max-w-md p-6 shadow-[0_0_80px_rgba(66,255,90,0.08)]"
        onClick={(event) => event.stopPropagation()}
      >
        <CornerMarks />
        <div className="flex items-start justify-between gap-4">
          <div>
            <Eyebrow tone="neon">Evaluations</Eyebrow>
            <h2 className="mt-1 text-xl font-semibold text-white">Confirm it&apos;s you.</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 place-items-center rounded-lg border border-white/10 text-zinc-500 transition hover:border-neon/40 hover:text-neon"
          >
            &times;
          </button>
        </div>
        <p className="mt-4 text-sm leading-6 text-zinc-500">
          The evaluations page shows every judge&apos;s scores and notes. Enter your name as it appears on
          your judge profile and your invitation code to open it.
        </p>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label className="block text-sm font-medium text-zinc-300">
            Your name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={user?.displayName ?? "Name on your judge profile"}
              autoComplete="name"
              className={inputField}
            />
          </label>
          <label className="block text-sm font-medium text-zinc-300">
            Invitation code
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              type="password"
              placeholder="The code you applied with"
              autoComplete="off"
              className={`${inputField} font-mono tracking-[0.14em]`}
            />
          </label>
          {error ? (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" aria-live="polite">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" disabled={pending || !name.trim() || !code.trim()} className={`${primaryButton} flex-1`}>
              {pending ? "Checking…" : "Open evaluations"}
              <span aria-hidden>→</span>
            </button>
            <button type="button" onClick={onClose} className={ghostButton}>
              Not now
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
