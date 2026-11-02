"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { usePlanContext } from "./plan-shell";
import type { Offering } from "./data";
import type { Placement } from "./use-plan";
import { buildRows, rowKind, type Scope } from "@/components/finder/catalog";
import { SchedulePair } from "@/components/schedule-pair/schedule-pair";

/* The Find page's scope for an open slot of each kind. */
const SLOT_SCOPE: Record<Placement["kind"], Scope> = {
  elective: "major-elective",
  "free-elective": "free",
  gened: "gened",
  core: "all",
};

/*
 * The plan page: the week and Your courses. Finding courses is its own page
 * (/find); courses shortlisted there arrive here as suggestions (productthink.md,
 * "Amended 2 November"). The student decides with Add / Drop, and Confirm plan
 * removes whatever was dropped.
 */
export function WeekPlan() {
  const plan = usePlanContext();
  const { placements, addCourse, toggleCourse, addShortlisted } = plan;
  const { codes, takeAll } = plan.shortlist;
  const rows = useMemo(
    () => buildRows({ placements, addCourse, toggleCourse }),
    [placements, addCourse, toggleCourse],
  );
  const rowByCode = useMemo(() => new Map(rows.map((r) => [r.code, r])), [rows]);

  /* Arrival: on mount, and whenever the shortlist changes while the student is here. */
  useEffect(() => {
    if (!codes.length) return;
    const arriving = takeAll()
      .map((code) => rowByCode.get(code)?.offering)
      .filter((o): o is Offering => o !== undefined);
    addShortlisted(arriving);
  }, [codes, takeAll, rowByCode, addShortlisted]);

  /* A course added from the catalog arrives as "elective"; colour it by what it counts for. */
  const kindFor = (p: Placement) => {
    if (!p.id.startsWith("catalog-")) return p.kind;
    const row = rowByCode.get(p.course.code);
    return row ? rowKind(row) : p.kind;
  };

  return (
    /* No page heading: the top bar already names the term and the step. */
    <div className="plan-week">
      <h1 className="sr-only">Your plan</h1>
      <SchedulePair
        plan={plan}
        kindFor={kindFor}
        findHref={(item) => `/find?scope=${SLOT_SCOPE[kindFor(item)]}`}
        coursesAction={
          <Link href="/find" className="sp-findlink">
            Find courses →
          </Link>
        }
      />
    </div>
  );
}
