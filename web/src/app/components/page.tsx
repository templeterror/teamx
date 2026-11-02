import type { Metadata } from "next";
import { Workbench } from "@/components/workbench/workbench";

export const metadata: Metadata = {
  title: "Components · Course Planner",
  /* Reachable by URL on purpose, unlinked; kept out of search results. */
  robots: { index: false, follow: false },
};

export default function ComponentsPage() {
  return <Workbench />;
}
