"use client";

import type { User } from "firebase/auth";
import { readSession, writeSession } from "@/lib/use-local-storage";

/**
 * Every judge action authenticates with a fresh Firebase ID token, never a
 * uid. The SDK refreshes it itself; null means signed out (or the refresh
 * failed), which the backend answers with 401.
 */
export async function idTokenFor(user: User | null) {
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

/**
 * The invitation code re-entered in the popup before the evaluations page.
 * Kept for this tab only: closing it means verifying again, and it never
 * reaches another tab or device. The backend re-checks it on every results
 * read, so this is a convenience, not the gate.
 */
const RESULTS_KEY = "hackgrid:judge-results-key";

export function readResultsKey() {
  return readSession(RESULTS_KEY);
}

export function writeResultsKey(code: string | null) {
  writeSession(RESULTS_KEY, code);
}
