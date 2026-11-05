import { Suspense, type ReactNode } from "react";
import { PlanShell } from "@/components/plan/plan-shell";
import { currentProgram } from "@/components/student/program-cookie";

/*
 * /find, /plan and /plan/review share one PlanShell, so client navigation
 * between them keeps the plan and the shortlist. The group adds nothing to the URL.
 */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Workspace>{children}</Workspace>
    </Suspense>
  );
}

/* The signed-in program comes from the sign-in cookie; a new program starts a fresh plan. */
async function Workspace({ children }: { children: ReactNode }) {
  const program = await currentProgram();
  return (
    <PlanShell key={program} program={program}>
      {children}
    </PlanShell>
  );
}
