import type { Metadata } from "next";
import { CoverageView } from "@/components/coverage-view";

export const metadata: Metadata = {
  title: "Coverage board",
  description: "Who owes what, trade by trade: bid coverage against the target, a call list, and chase email drafts.",
};

export default function CoveragePage() {
  return <CoverageView />;
}
