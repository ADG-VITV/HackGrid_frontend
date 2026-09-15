import type { Metadata } from "next";
import { JudgeClient } from "./judge-client";

export const metadata: Metadata = {
  title: "Judge | HackGrid",
  description: "Review HackGrid teams against the official judging criteria.",
};

// The navbar comes from the root ClientLayout like every other page; nothing
// is rendered twice here.
export default function JudgePage() {
  return <JudgeClient />;
}
