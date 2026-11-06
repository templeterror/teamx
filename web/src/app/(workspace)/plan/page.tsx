import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { WeekPlan } from "@/components/plan/week-plan";
import { CURRENT_TERM, closedTermByName } from "@/components/plan/terms";
import { currentProfile } from "@/components/student/profile-cookie";

export const metadata: Metadata = {
  title: "Your plan · Course Planner",
};

export default function PlanPage({ searchParams }: PageProps<"/plan">) {
  return (
    <Suspense fallback={null}>
      <ResolvedPlan searchParams={searchParams} />
    </Suspense>
  );
}

/* Only the open term is a plan. Old links to a closed term land on its read-only record. */
async function ResolvedPlan({ searchParams }: Pick<PageProps<"/plan">, "searchParams">) {
  const { term } = await searchParams;
  if (typeof term === "string" && term !== CURRENT_TERM) {
    const closed = closedTermByName(await currentProfile(), term);
    redirect(closed ? `/term/${closed.slug}` : "/term");
  }
  return <WeekPlan />;
}
