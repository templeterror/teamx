import type { Metadata } from "next";
import { Suspense } from "react";
import type { Scope } from "@/components/finder/catalog";
import { FindPage } from "@/components/finder/find-page";

export const metadata: Metadata = {
  title: "Find courses · Course Planner",
};

const SCOPES: Scope[] = ["major-elective", "gened", "free", "all"];

/* ?scope= preselects the Counts for chip; an open slot on the plan links here with it. */
export default function Find({ searchParams }: PageProps<"/find">) {
  return (
    <Suspense fallback={null}>
      <ResolvedFind searchParams={searchParams} />
    </Suspense>
  );
}

async function ResolvedFind({ searchParams }: Pick<PageProps<"/find">, "searchParams">) {
  const { scope } = await searchParams;
  const given = SCOPES.find((s) => s === scope) ?? null;
  return <FindPage key={given ?? "none"} scope={given ?? "major-elective"} scoped={given !== null} />;
}
