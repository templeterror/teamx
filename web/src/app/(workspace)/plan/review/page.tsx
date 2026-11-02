import type { Metadata } from "next";
import { Review } from "@/components/plan/review";

export const metadata: Metadata = {
  title: "Review & register · Course Planner",
};

export default function ReviewPage() {
  return <Review />;
}
