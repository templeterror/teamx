"use client";

import Link from "next/link";
import type { Offering } from "./data";
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
 *   locked — not confirmed: a problem (under 12 credits, over 18, overlapping classes),
 *            suggestions, or drops waiting on Confirm plan.
 *   ready  — the course list, and the handoff. A confirmed plan has no problems.
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
            <h1>Confirm your plan first</h1>
            <p className="intro">
              {active.length === 0
                ? "Your plan has no courses to confirm yet."
                : plan.problems.length > 0
                  ? `Your plan can’t be confirmed until ${plan.problems.length === 1 ? "this is fixed" : "these are fixed"}, so review stays closed.`
                  : suggested.length > 0
                    ? `${suggested.length} of ${active.length} courses ${suggested.length === 1 ? "is still a suggestion" : "are still suggestions"}, so review stays closed.`
                    : `You dropped ${plan.pendingDrops.map((p) => p.course.code).join(", ")}. Confirm your plan to remove ${plan.pendingDrops.length === 1 ? "it" : "them"}, and review opens.`}
            </p>
          </div>
          <Link className="btn-primary" href="/plan">
            Back to your plan
          </Link>
        </header>
        {plan.problems.length > 0 && (
          <section className="review-blockers" aria-labelledby="review-blockers">
            <h2 id="review-blockers" className="sr-only">
              Fix before confirming
            </h2>
            <ul>
              {plan.problems.map((p) => (
                <li key={p.key}>
                  <span className="review-blocker-icon" aria-hidden="true">
                    !
                  </span>
                  <p>{p.text}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
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
                </li>
              ))}
            </ul>
          </section>
        )}
      </>
    );
  }

  return (
    <>
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">{CURRENT_TERM} / Review &amp; register</p>
          <h1>Ready for Banner</h1>
          <p className="intro">Planning does not register you. Use this list to register in Banner.</p>
        </div>
        <button className="btn-primary" onClick={() => window.print()}>
          Print course list
        </button>
      </header>

      <section className="review-panel" aria-labelledby="review-list">
        <div className="review-summary">
          <h2 id="review-list" className="review-title">
            Your course list
          </h2>
          <span>
            {active.length} courses · {plan.credits} credits · No time conflicts
          </span>
        </div>
        <ul className="review-list">
          {active.map((p) => (
            <li className="review-row" key={p.id}>
              <div>
                <strong>{p.course.code}</strong>
                <p>{p.course.title}</p>
                <small>
                  {meets(p.course)} · {KIND[p.kind]}
                </small>
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
