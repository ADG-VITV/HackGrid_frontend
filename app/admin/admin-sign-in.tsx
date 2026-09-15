"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signInAdminAction } from "./actions";

export function AdminSignIn() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const report = await signInAdminAction(name, password);
      if (report.status === "success") {
        router.refresh();
        return;
      }
      setMessage(report.message);
    });
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-black px-4 text-zinc-100">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-400">HackGrid</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Admin sign in</h1>
        <div className="mt-6 grid gap-4">
          <label className="grid gap-1.5 text-sm text-zinc-300">
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="username"
              required
              className="rounded-lg border border-zinc-700 bg-black px-3 py-2.5 text-white outline-none focus:border-neon"
            />
          </label>
          <label className="grid gap-1.5 text-sm text-zinc-300">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="rounded-lg border border-zinc-700 bg-black px-3 py-2.5 text-white outline-none focus:border-neon"
            />
          </label>
        </div>
        {message ? <p className="mt-4 text-sm text-red-300">{message}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full rounded-lg border border-neon/60 bg-neon/10 px-4 py-2.5 text-sm font-semibold text-neon hover:bg-neon/20 disabled:opacity-40"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
