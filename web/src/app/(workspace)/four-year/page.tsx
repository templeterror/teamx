import type { Metadata } from "next";
import { FourYearPlan } from "@/components/four-year/four-year-plan";

export const metadata: Metadata = {
  title: "Four-year plan · Course Planner",
};

export default function FourYearPlanPage() {
  return <FourYearPlan />;
}
