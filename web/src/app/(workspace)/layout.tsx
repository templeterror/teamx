import type { ReactNode } from "react";
import { PlanShell } from "@/components/plan/plan-shell";

/*
 * /find, /plan and /plan/review share one PlanShell, so client navigation
 * between them keeps the plan and the shortlist. The group adds nothing to the URL.
 */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <PlanShell>{children}</PlanShell>;
}
