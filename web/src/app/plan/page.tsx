import { Suspense } from "react";
import { WeekPlan } from "@/components/plan/week-plan";

export default function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <ResolvedPlan searchParams={searchParams} />
    </Suspense>
  );
}

async function ResolvedPlan({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  const { term } = await searchParams;
  return <WeekPlan term={term || "Spring 2027"} />;
}
