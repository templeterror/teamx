"use client";

import Link from "next/link";
import { CREDIT_MAX, type Offering } from "./data";
import { usePlanContext } from "./plan-shell";
import { CURRENT_TERM } from "./terms";
import type { Placement } from "./use-plan";

const KIND: Record<Placement["kind"], string> = {
  core: "Required",
  elective: "Elective",
  gened: "Gen ed",
  "free-elective": "Free elective",
};

/* Same clock as course search, so a time reads the same on every page. */
function time(minutes: number) {
  return `${Math.floor(minutes / 60) % 12 || 12}:${String(minutes % 60).padStart(2, "0")}`;
}

function meets(course: Offering) {
  const suffix = course.end < 720 ? "am" : "pm";
  return `${course.days.join(" · ")}, ${time(course.start)}–${time(course.end)} ${suffix}`;
}

/*
 * The last step before Banner, so it holds the line:
 *   locked  — some courses are still suggestions. Confirm plan is the decision.
 *   blocked — confirmed, but the week cannot work (overlaps, over the credit limit).
 *   ready   — the course list, and the handoff.
 */
export function Review() {
  const plan = usePlanContext();
  const active = plan.placements.filter((p) => !p.deferred);
  const suggested = active.filter((p) => !plan.confirmed[p.id]);

  if (!plan.planConfirmed) {
    return (
      <>
        <header className="workspace-heading">
          <div>
            <p className="eyebrow">{CURRENT_TERM} / Review &amp; register</p>
            <h1>Confirm your plan first.</h1>
            <p className="intro">
              {active.length === 0
                ? "Your plan has no courses yet. Add courses, then confirm the semester."
                : `Review opens once the whole semester is confirmed. ${suggested.length} of ${active.length} courses are still suggestions.`}
            </p>
          </div>
          <Link className="btn primary" href="/plan">
            Back to your plan
          </Link>
        </header>
        {suggested.length > 0 && (
          <section className="review-panel" aria-labelledby="review-pending">
            <h2 id="review-pending" className="review-title">
              Still suggested
            </h2>
            <ul className="review-list">
              {suggested.map((p) => (
                <li className="review-row" key={p.id}>
                  <div>
                    <strong>{p.course.code}</strong>
                    <p>{p.course.title}</p>
                    <small>{KIND[p.kind]}</small>
                  </div>
                  <span className="review-tag">Suggested</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </>
    );
  }

  const blockers = [
    ...plan.conflicts.map(([a, b]) => ({
      key: `${a.id}-${b.id}`,
      title: `${a.course.code} and ${b.course.code} overlap`,
      detail: `${meets(a.course)} and ${meets(b.course)}. Banner will not register both. Swap one, or move one to a later term.`,
    })),
    ...(plan.over
      ? [
          {
            key: "credits",
            title: `${plan.credits} credits, ${plan.over} over the ${CREDIT_MAX}-credit limit`,
            detail: "Going over needs an advisor’s approval. Drop a course, or move one to a later term.",
          },
        ]
      : []),
  ];
  const conflicted = new Set(plan.conflicts.flat().map((p) => p.id));

  return (
    <>
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">{CURRENT_TERM} / Review &amp; register</p>
          <h1>
            {blockers.length === 0
              ? "Ready for Banner."
              : blockers.length === 1
                ? "One thing to fix before Banner."
                : `${blockers.length} things to fix before Banner.`}
          </h1>
          <p className="intro">
            {blockers.length === 0
              ? "Planning does not register you. Use this list to register in Banner."
              : "Your plan is confirmed, but this week cannot be registered as it is."}
          </p>
        </div>
        {blockers.length === 0 && (
          <button className="btn primary" onClick={() => window.print()}>
            Print course list
          </button>
        )}
      </header>

      {blockers.length > 0 && (
        <section className="review-blockers" aria-labelledby="review-blockers">
          <h2 id="review-blockers" className="sr-only">
            Fix before registering
          </h2>
          <ul>
            {blockers.map((b) => (
              <li key={b.key}>
                <span className="review-blocker-icon" aria-hidden="true">
                  !
                </span>
                <div>
                  <strong>{b.title}</strong>
                  <p>{b.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          <Link className="btn primary" href="/plan">
            Fix in your plan
          </Link>
        </section>
      )}

      <section className="review-panel" aria-labelledby="review-list">
        <div className="review-summary">
          <h2 id="review-list" className="review-title">
            Your course list
          </h2>
          <span>
            {active.length} courses · {plan.credits} credits ·{" "}
            {plan.conflicts.length === 0
              ? "No time conflicts"
              : `${plan.conflicts.length} time ${plan.conflicts.length === 1 ? "conflict" : "conflicts"}`}
          </span>
        </div>
        <ul className="review-list">
          {active.map((p) => (
            <li className="review-row" key={p.id} data-conflict={conflicted.has(p.id) || undefined}>
              <div>
                <strong>{p.course.code}</strong>
                <p>{p.course.title}</p>
                <small>
                  {meets(p.course)} · {KIND[p.kind]}
                </small>
                {conflicted.has(p.id) && <p className="warn">Time conflict</p>}
              </div>
              <span>{p.course.credits} credits</span>
            </li>
          ))}
        </ul>
        <div className="review-actions">
          <Link className="btn text" href="/plan">
            ← Back to your plan
          </Link>
        </div>
      </section>
    </>
  );
}
