"use client";

import Link from "next/link";
import type { ProgramCode, StudentRecord } from "@/data";
import { graduationProgress, type GraduationProgress, type RequirementProgress } from "@/components/progress/progress";
import { CREDIT_MAX, type Board } from "@/components/four-year/board";
import { GROUP_ORDER, graduationHeadline, groupOf } from "@/components/four-year/progress-panel";
import { AlertIcon } from "@/components/four-year/icons";
import type { FinderRow } from "@/components/finder/catalog";
import { CURRENT_TERM } from "./terms";
import type { Placement } from "./use-plan";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/* Rows "Still left after this term" shows before "and N more". */
const LEFT_SHOWN = 6;

type Line = { item: Placement; credits: number; counts: string };

/* "Gen ed: Arts", "Free elective", "Upper-level credits": a row as one course's line names it. */
function countsLabel(row: RequirementProgress) {
  if (row.id === "free-electives") return "Free elective";
  const label = row.label.replace(/\s*\(.*\)$/, "");
  return row.group === "gened" ? `Gen ed: ${label}` : label;
}

/*
 * This term against the degree, from the same progress model as /four-year.
 *   through: the record plus this term's plan, nothing later. What each course counts
 *            toward, and what is still open once the term is done.
 *   full:    that plus the four-year board's placements, for the "planned" part of the meter.
 * A plan course already on the record in an earlier term counts for nothing again; one on
 * the record for this term (Rafiat's registration) is this term's, not "in progress".
 */
export function termSummary(program: ProgramCode, record: StudentRecord, board: Board, active: Placement[]) {
  const recordTerm = new Map(record.terms.flatMap((term) => term.courses.map((course) => [course.code, term.term] as const)));
  const termPlaced = active
    .filter((item) => !recordTerm.has(item.course.code))
    .map((item) => ({ code: item.course.code, credits: item.course.credits, term: CURRENT_TERM }));
  const through = graduationProgress(program, record, termPlaced);
  const full = graduationProgress(program, record, [...termPlaced, ...board.placed]);

  const lines: Line[] = active.map((item) => {
    const { code, credits } = item.course;
    const taken = recordTerm.get(code);
    if (taken && taken !== CURRENT_TERM) return { item, credits: 0, counts: `Already taken ${taken} · not counted again` };
    const rows = through.requirements.filter((row) =>
      row.satisfiedBy.some((entry) => entry.code === code && entry.term === CURRENT_TERM));
    const labels = [...new Set(rows.map(countsLabel))];
    return { item, credits, counts: labels.length ? labels.join(" · ") : "Not counted toward your degree" };
  });
  const thisTerm = lines.reduce((sum, line) => sum + line.credits, 0);

  /* In progress: on the record, not finished, and not one of this term's courses. */
  const onPlan = new Set(active.map((item) => item.course.code));
  const inProgress = record.terms.flatMap((term) => term.courses.flatMap((course) => {
    const state = course.status ?? term.status;
    return state === "completed" || (term.term === CURRENT_TERM && onPlan.has(course.code)) ? [] : [course.credits];
  })).reduce((sum, credits) => sum + credits, 0);

  const done = through.totalCredits.done;
  const left = through.requirements
    .filter((row) => row.status === "missing")
    /* Biggest first, so a capped list names what most of the remaining work is; ties in the rail's group order. */
    .sort((a, b) => b.missingCredits - a.missingCredits || GROUP_ORDER.indexOf(groupOf(a)) - GROUP_ORDER.indexOf(groupOf(b)));

  return {
    lines,
    left,
    credits: {
      required: full.totalCredits.required,
      done,
      inProgress,
      thisTerm,
      after: done + inProgress + thisTerm,
      planned: full.totalCredits.planned - through.totalCredits.planned,
      missing: full.totalCredits.missing,
    },
  };
}

type Props = {
  program: ProgramCode;
  record: StudentRecord;
  /* /four-year's graduation progress, for the headline. */
  progress: GraduationProgress;
  board: Board;
  /* This term's courses on the plan, not dropped or deferred. */
  active: Placement[];
  confirmed: Record<string, boolean>;
  credits: number;
  kindFor: (item: Placement) => Placement["kind"];
  rowByCode: Map<string, FinderRow>;
};

/*
 * The review page's rail: what this term does for the degree. ProgressPanel's headline,
 * meter and legend (four-year.css), then one line per course naming what it counts toward,
 * what is still open after the term, and the warnings that are about this term.
 */
export function TermProgress({ program, record, progress, board, active, confirmed, credits, kindFor, rowByCode }: Props) {
  const { headline, problem, detail } = graduationHeadline(progress, board.goal, board, false);
  const summary = termSummary(program, record, board, active);
  const total = summary.credits;

  const required = Math.max(total.required, 1);
  const share = (value: number) => `${Math.min(value / required, 1) * 100}%`;
  let room = required;
  const segments = (["done", "progress", "term", "planned"] as const).map((seg) => {
    const value = { done: total.done, progress: total.inProgress, term: total.thisTerm, planned: total.planned }[seg];
    const width = Math.min(value, room);
    room -= width;
    return { seg, width };
  });
  const legend = [
    { seg: "done", count: total.done, label: "done" },
    ...(total.inProgress ? [{ seg: "progress", count: total.inProgress, label: "in progress" }] : []),
    { seg: "term", count: total.thisTerm, label: "this term" },
    { seg: "planned", count: total.planned, label: "planned" },
    ...(total.missing ? [{ seg: "missing", count: total.missing, label: "missing" }] : []),
  ];

  const outOfOrder = active.flatMap((item) => {
    const eligibility = rowByCode.get(item.course.code)?.eligibility;
    return eligibility?.status === "missing" ? [{ code: item.course.code, needs: eligibility.groups }] : [];
  });
  const shown = summary.left.slice(0, LEFT_SHOWN);
  const more = summary.left.length - shown.length;

  return (
    <div className="fy-progress rv-term">
      <div className="fy-headline" aria-live="polite">
        <h2>{headline}</h2>
        {(problem || detail) && (
          <p>
            {problem && <span className="fy-headline-problem">{problem}</span>}
            {problem && detail && " "}
            {detail}
          </p>
        )}
      </div>

      <div className="fy-meter-block">
        <p className="fy-meter-caption">
          <span>
            This term: <span className="fy-num">{plural(total.thisTerm, "credit")}</span>
            <span aria-hidden="true"> → </span>
            <span className="fy-sr">, </span>
            <span className="fy-num">{total.after} of {total.required}</span> after {CURRENT_TERM}
          </span>
        </p>
        <div className="fy-meter" role="img"
          aria-label={`${total.done} credits done, ${total.inProgress} in progress, ${total.thisTerm} this term, ${total.planned} planned, ${total.missing} missing, of ${total.required}`}>
          {segments.map(({ seg, width }) => <span key={seg} data-seg={seg} style={{ width: share(width) }} />)}
        </div>
        <ul className="fy-legend" aria-hidden="true">
          {legend.map(({ seg, count, label }) => (
            <li key={seg} data-seg-item={seg}>
              <i data-seg={seg} />
              <b className="fy-num">{count}</b> {label}
            </li>
          ))}
        </ul>
      </div>

      {(credits > CREDIT_MAX || outOfOrder.length > 0) && (
        <div className="fy-checks">
          {credits > CREDIT_MAX && (
            <p data-tone="warning">
              <AlertIcon />
              <span>{CURRENT_TERM} is {credits} credits — over {CREDIT_MAX} needs approval</span>
            </p>
          )}
          {outOfOrder.map(({ code, needs }) => (
            <p key={code} data-tone="warning">
              <AlertIcon />
              <span>{code} needs {needs.join(" and ")} first</span>
            </p>
          ))}
        </div>
      )}

      <div className="fy-groups rv-term-groups">
        {summary.lines.length > 0 && (
          <section aria-labelledby="rv-counts">
            <h3 id="rv-counts" className="fy-group-head">What this term counts toward</h3>
            <ul className="fy-rows">
              {summary.lines.map(({ item, counts }) => {
                const suggested = !confirmed[item.id];
                return (
                  <li key={item.id} className="fy-row" data-kind={kindFor(item)} data-suggested={suggested || undefined}>
                    <span className="fy-row-code">{item.course.code}</span>
                    <span className="fy-row-title">
                      <span className="rv-term-arrow" aria-hidden="true">→</span>
                      <span>
                        {suggested && <span className="fy-sr">Suggested: </span>}
                        {counts}
                      </span>
                    </span>
                    <span className="fy-row-credits">{item.course.credits}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section aria-labelledby="rv-left">
          <h3 id="rv-left" className="fy-group-head">Still left after this term</h3>
          {shown.length ? (
            <ul className="fy-reqs">
              {shown.map((row) => (
                <li key={row.id} className="fy-req rv-term-left">
                  <span className="fy-req-label">{row.label}</span>
                  <span className="fy-req-status">{row.missingCredits} cr</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="fy-req-note">Every requirement is met or under way.</p>
          )}
          {more > 0 && <p className="fy-req-note rv-term-more">and {more} more</p>}
          <Link href="/four-year" className="fy-link rv-term-link">
            See four-year plan <span aria-hidden="true">→</span>
          </Link>
        </section>
      </div>

      <p className="fy-advisor">Confirm the plan with your advisor before you register.</p>
    </div>
  );
}
