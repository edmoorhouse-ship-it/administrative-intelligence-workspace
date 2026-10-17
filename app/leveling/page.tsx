import type { Metadata } from "next";
import { LevelingView } from "@/components/leveling-view";

export const metadata: Metadata = {
  title: "Bid leveling",
  description: "Level one trade's subcontractor proposals: bid form, tie-out, normalized comparison, and the BuildingConnected plug table.",
};

export default function LevelingPage() {
  return <LevelingView />;
}
