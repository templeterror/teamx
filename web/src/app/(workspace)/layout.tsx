import { Suspense, type ReactNode } from "react";
import { PlanShell } from "@/components/plan/plan-shell";
import { currentProfile } from "@/components/student/profile-cookie";

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

/*
 * The signed-in profile comes from its cookie. Keyed by profile, so switching in the top
 * bar mounts the other person's plan fresh rather than carrying one person's state into it.
 */
async function Workspace({ children }: { children: ReactNode }) {
  const profile = await currentProfile();
  return (
    <PlanShell key={profile} profile={profile}>
      {children}
    </PlanShell>
  );
}
