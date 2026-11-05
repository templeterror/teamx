import type { Metadata } from "next";
import { Suspense } from "react";
import { closedTerms } from "@/components/plan/terms";
import { currentProgram } from "@/components/student/program-cookie";
import { TermPicker } from "./term-picker";

export const metadata: Metadata = {
  title: "Select a term · Course Planner",
};

export default function TermPage() {
  return (
    <Suspense fallback={null}>
      <ResolvedTerms />
    </Suspense>
  );
}

/* Old terms are the signed-in student's own; a new student has none. */
async function ResolvedTerms() {
  return <TermPicker closedTerms={closedTerms(await currentProgram())} />;
}
