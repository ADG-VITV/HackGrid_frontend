import type { Metadata } from "next";
import { EvaluationsClient } from "./evaluations-client";

export const metadata: Metadata = {
  title: "Evaluations | HackGrid",
  description: "Team-by-team HackGrid judging results.",
};

export default function EvaluationsPage() {
  return <EvaluationsClient />;
}
