"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";
import { usePlan } from "./use-plan";
import { useShortlist, type Shortlist } from "./use-shortlist";
import { CURRENT_TERM } from "./terms";
import "./plan.css";

type Plan = ReturnType<typeof usePlan> & { shortlist: Shortlist };

const PlanContext = createContext<Plan | null>(null);

/* One plan for /find, /plan and /plan/review, so moving between them keeps every choice and the shortlist. */
export function usePlanContext() {
  const plan = useContext(PlanContext);
  if (!plan) throw new Error("usePlanContext must be used inside PlanShell");
  return plan;
}

const STEPS = [
  { href: "/find", label: "Find" },
  { href: "/plan", label: "Your plan" },
  /* The tail hides at phone width to save space; it stays in the accessible name. */
  { href: "/plan/review", label: "Review", tail: " & register" },
  { href: "/four-year", label: "Four-year plan" },
] as const;

export function PlanShell({ children }: { children: ReactNode }) {
  const plan = usePlan();
  const shortlist = useShortlist();
  const pathname = usePathname();

  return (
    <PlanContext.Provider value={{ ...plan, shortlist }}>
      <div className="plan workspace">
        {/* The sidebar laid flat across the top, so the week below gets the full width. */}
        <header className="plan-topbar">
          <Link href="/term" className="plan-topbar-brand">
            <b aria-hidden="true">T</b>
            <span>
              Course Planner<small>Temple University</small>
            </span>
          </Link>
          <div className="plan-topbar-term">
            <span>{CURRENT_TERM}</span>
            <Link href="/term">Change term</Link>
          </div>
          <nav className="plan-topbar-steps" aria-label="Planning workspace">
            {STEPS.map((step) => {
              /* Review is reachable, but dimmed until Confirm plan; the page says why. */
              const locked = step.href === "/plan/review" && !plan.planConfirmed;
              /*
               * After Confirm plan this step is the screen's one red primary, except on /find
               * while the shortlist holds courses: there "Back to plan" is, and those courses reopen the plan.
               */
              const ready =
                step.href === "/plan/review" &&
                plan.planConfirmed &&
                pathname !== step.href &&
                pathname !== "/four-year" &&
                !(pathname === "/find" && shortlist.count > 0);
              return (
                <Link
                  key={step.href}
                  href={step.href}
                  aria-current={pathname === step.href ? "page" : undefined}
                  data-locked={locked || undefined}
                  data-ready={ready || undefined}
                >
                  <span className="plan-topbar-step">
                    {step.label}
                    {"tail" in step && <span className="plan-topbar-step-tail">{step.tail}</span>}
                  </span>
                </Link>
              );
            })}
          </nav>
          <p className="plan-topbar-student">
            Rafiat Amir<small>Computer Science · BS</small>
          </p>
        </header>
        <main className="workspace-main">{children}</main>
      </div>
    </PlanContext.Provider>
  );
}
