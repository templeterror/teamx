"use client";

/*
 * The Drill-in course page on the Find page (productthink.md, "Course details"
 * and "Finding courses is its own page"). It slides over the mini week and the
 * shortlist; "‹ Your week and shortlist" slides back. Its action is Shortlist /
 * Remove from shortlist; Add and Drop stay on the plan.
 * Every class is `course-page-` prefixed.
 */

import type { RefObject } from "react";
import { courses, degree } from "@/data";
import { SHORTLIST_MAX, type Shortlist } from "@/components/plan/use-shortlist";
import { COMPLETED, formatCredits, formatMeeting, rowKind, type FinderRow, type Plan } from "./catalog";
import "./course-page.css";

type RawExpr = { op?: "all" | "any"; of?: RawExpr[]; kind?: string; code?: string };
type RawCourse = {
  code: string;
  title: string;
  credits: { value?: number; options?: number[]; min?: number; max?: number };
  prerequisites: { raw: string; expression: RawExpr | null } | null;
};
const RAW = courses as unknown as Record<string, RawCourse>;

const ATTRIBUTE_NAMES: Record<string, string> = (() => {
  const out: Record<string, string> = { HO: "Honors", WI: "Writing intensive" };
  const walk = (n: unknown) => {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === "object") {
      const o = n as Record<string, unknown>;
      if (typeof o.attribute === "string" && typeof o.title === "string") out[o.attribute] = `Gen ed · ${o.title}`;
      Object.values(o).forEach(walk);
    }
  };
  walk(degree);
  return out;
})();

function roleIn(e: RawExpr | null | undefined, code: string, inAny = false): "required" | "option" | null {
  if (!e) return null;
  if (e.kind === "course") return e.code === code ? (inAny ? "option" : "required") : null;
  let found: "required" | "option" | null = null;
  for (const child of e.of ?? []) {
    const r = roleIn(child, code, inAny || e.op === "any");
    if (r === "required") return r;
    found ??= r;
  }
  return found;
}

function courseLeaves(e: RawExpr | null | undefined, out: Set<string>) {
  if (!e) return out;
  if (e.kind === "course" && e.code) out.add(e.code);
  for (const child of e.of ?? []) courseLeaves(child, out);
  return out;
}

type Unlock = { code: string; title: string; role: "required" | "option" };
let UNLOCKS: Map<string, Unlock[]> | null = null;
function unlocksFor(code: string): Unlock[] {
  if (!UNLOCKS) {
    UNLOCKS = new Map();
    for (const c of Object.values(RAW)) {
      const expr = c.prerequisites?.expression;
      for (const leaf of courseLeaves(expr, new Set())) {
        const list = UNLOCKS.get(leaf) ?? [];
        list.push({ code: c.code, title: c.title, role: roleIn(expr, leaf) ?? "required" });
        UNLOCKS.set(leaf, list);
      }
    }
    for (const list of UNLOCKS.values()) list.sort((a, b) => a.code.localeCompare(b.code));
  }
  return UNLOCKS.get(code) ?? [];
}

const COURSE_CODE = /[A-Z]{2,4} \d{4}[A-Z]?/g;

function creditRange(code: string): string | null {
  const cr = RAW[code]?.credits;
  const vals = cr?.options?.length ? cr.options : [cr?.min, cr?.max].filter((v): v is number => typeof v === "number");
  if (!vals.length) return null;
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
}

function creditsLong(row: FinderRow) {
  if (row.credits !== null) return `${row.credits} ${row.credits === 1 ? "credit" : "credits"}`;
  const range = creditRange(row.code);
  return range ? `${range} credits` : formatCredits(null);
}

function shortTitle(title: string) {
  return title.replace(/^(Principles of|Introduction to)\s+/i, "").split(":")[0];
}

function needsText(row: FinderRow): string | null {
  if (row.eligibility.status !== "missing") return null;
  const needs = row.eligibility.needs;
  if (!needs.length) return "Prereqs not met";
  const root = RAW[row.code]?.prerequisites?.expression;
  const codes = new Set(needs.map((n) => n.code));
  const siblings =
    root?.op === "all" ? (root.of ?? []).filter((c) => c.kind === "course" && c.code && codes.has(c.code)).length : 0;
  const joiner = siblings >= 2 ? "and" : "or";
  const shown = needs.slice(0, 2).map((n) => n.code).join(` ${joiner} `);
  return `Needs ${shown}${needs.length > 2 ? ` +${needs.length - 2}` : ""}`;
}

function conflictText(withList: { title: string }[]) {
  const names = withList.slice(0, 2).map((w) => shortTitle(w.title));
  return `Conflicts with ${names.join(", ")}${withList.length > 2 ? ` +${withList.length - 2}` : ""}`;
}

function fitText(row: FinderRow): { text: string; tone: "warn" | "quiet" } | null {
  if (row.completed || row.inPlan) return null;
  if (!row.offering.days.length) return { text: "Time to be announced", tone: "quiet" };
  if (row.fit.status === "conflict") return { text: conflictText(row.fit.with), tone: "warn" };
  return { text: "Fits your week", tone: "quiet" };
}

function restrictionShort(r: string | null) {
  if (!r) return null;
  if (/honors/i.test(r)) return "Honors students only";
  if (/field of study/i.test(r)) return "Some majors only";
  if (/class restrictions/i.test(r)) return "Class standing limits";
  if (/department/i.test(r)) return "Some departments only";
  return "Some cohorts only";
}

function restrictionLines(r: string | null) {
  if (!r) return [];
  return r.split(" · ").map((part) => {
    const [key, ...rest] = part.split(": ");
    const label = key.charAt(0) + key.slice(1).toLowerCase();
    return rest.length ? `${label}: ${rest.join(": ")}` : part;
  });
}

export function CoursePage({
  row,
  plan,
  shortlist,
  backRef,
  scrollRef,
  onBack,
  onAnnounce,
}: {
  row: FinderRow | undefined;
  plan: Plan;
  shortlist: Shortlist;
  backRef: RefObject<HTMLButtonElement | null>;
  scrollRef: RefObject<HTMLDivElement | null>;
  onBack: () => void;
  onAnnounce: (text: string) => void;
}) {
  return (
    <>
      <header className="course-page-head">
        <button type="button" ref={backRef} className="course-page-back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m10 4-4 4 4 4" />
          </svg>
          Your week and shortlist
        </button>
      </header>
      {row && <Page row={row} plan={plan} shortlist={shortlist} scrollRef={scrollRef} onAnnounce={onAnnounce} />}
    </>
  );
}

function Page({
  row,
  plan,
  shortlist,
  scrollRef,
  onAnnounce,
}: {
  row: FinderRow;
  plan: Plan;
  shortlist: Shortlist;
  scrollRef: RefObject<HTMLDivElement | null>;
  onAnnounce: (text: string) => void;
}) {
  const placement = plan.placements.find((p) => !p.deferred && p.course.code === row.code);
  const planCodes = new Set(plan.placements.filter((p) => !p.deferred).map((p) => p.course.code));
  const clashes = placement ? plan.conflictsFor(placement.id) : [];
  const fit = fitText(row);
  const unlocks = unlocksFor(row.code);
  const raw = RAW[row.code]?.prerequisites?.raw ?? "";
  const prereqCodes = [...new Set(raw.match(COURSE_CODE) ?? [])];
  const needs = row.eligibility.status === "missing" ? row.eligibility.needs : [];
  const needCodes = new Set(needs.map((n) => n.code));
  const named = row.attributes.filter((a) => ATTRIBUTE_NAMES[a]).map((a) => ATTRIBUTE_NAMES[a]);
  const otherAttrs = row.attributes.filter((a) => !ATTRIBUTE_NAMES[a]);
  const restriction = restrictionLines(row.restriction);
  const kind = row.countsFor.kind === "free" ? "free" : rowKind(row);
  const needsLine = needsText(row);
  const on = shortlist.has(row.code);
  const blocked = !on && shortlist.full;

  return (
    <>
      <div className="course-page-scroll" ref={scrollRef}>
        <article className="course-page">
          <header className="course-page-title">
            <span className="course-page-eyebrow">
              <span className="course-page-code">{row.code}</span>
              <span className="course-page-dot" aria-hidden="true">·</span>
              <span>{creditsLong(row)}</span>
              <span className="course-page-dot" aria-hidden="true">·</span>
              <span className="course-page-counts" data-kind={kind}>{row.countsFor.label}</span>
            </span>
            <h3>{row.title}</h3>
            <span className="course-page-when">{formatMeeting(row.offering)}</span>
            {placement ? (
              clashes.length > 0 ? (
                <span className="course-page-status" data-tone="warn">
                  {conflictText(clashes.map((c) => c.course))}
                </span>
              ) : (
                <span className="course-page-status" data-tone="ok">In your plan</span>
              )
            ) : row.completed ? (
              <span className="course-page-status">Completed</span>
            ) : (
              fit && (
                <span className="course-page-status" data-tone={fit.tone === "warn" ? "warn" : undefined}>
                  {fit.text}
                </span>
              )
            )}
            {!row.completed && !placement && restrictionShort(row.restriction) && (
              <span className="course-page-status">{restrictionShort(row.restriction)}. See Good to know.</span>
            )}
          </header>

          {row.section.id && (
            <dl className="course-page-facts">
              <div>
                <dt>Section</dt>
                <dd>{row.section.section}</dd>
              </div>
              <div>
                <dt>Instructor</dt>
                <dd>{row.section.instructor}</dd>
              </div>
              <div>
                <dt>Campus</dt>
                <dd>{row.section.campus}</dd>
              </div>
            </dl>
          )}

          <section className="course-page-sec">
            <h4>About this course</h4>
            <p>{row.description || "No description in the bulletin."}</p>
          </section>

          <section className="course-page-sec">
            <h4>Prerequisite for</h4>
            {unlocks.length ? (
              <>
                <ul className="course-page-courselist">
                  {unlocks.slice(0, 6).map((u) => (
                    <li key={u.code}>
                      <b>{u.code}</b>
                      <span>
                        {u.title}
                        {(u.role === "option" || planCodes.has(u.code)) && (
                          <small>
                            {[u.role === "option" ? "One of several accepted courses" : null, planCodes.has(u.code) ? "In your plan" : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {unlocks.length > 6 && <p className="course-page-fine">And {unlocks.length - 6} more in the bulletin.</p>}
              </>
            ) : (
              <p>No other course lists it as a prerequisite.</p>
            )}
          </section>

          <section className="course-page-sec">
            <h4>Prerequisites</h4>
            {raw ? (
              <>
                {prereqCodes.length > 0 && (
                  <ul className="course-page-courselist">
                    {prereqCodes.slice(0, 6).map((code) => {
                      const state = COMPLETED.has(code)
                        ? "Completed"
                        : planCodes.has(code)
                          ? "In your plan"
                          : needCodes.has(code)
                            ? "Still needed"
                            : null;
                      return (
                        <li key={code}>
                          <b>{code}</b>
                          <span>
                            {RAW[code]?.title ?? "Not in this bulletin"}
                            {state && <small data-tone={state === "Still needed" ? "need" : undefined}>{state}</small>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {prereqCodes.length > 6 && (
                  <p className="course-page-fine">And {prereqCodes.length - 6} more, in the bulletin wording below.</p>
                )}
                {row.eligibility.status === "missing" && needsLine && (
                  <p className="course-page-need">You still need {needsLine.replace(/^Needs /, "")}.</p>
                )}
                {row.eligibility.status === "unknown" && (
                  <p className="course-page-need">
                    Part of this can be met by a placement score, which your plan can’t see. Check with your advisor.
                  </p>
                )}
                <p className="course-page-fine">Bulletin: {raw.replace(/\.?$/, ".")}</p>
              </>
            ) : (
              <p>None.</p>
            )}
          </section>

          {(row.attributes.length > 0 || row.typicallyOffered || restriction.length > 0) && (
            <section className="course-page-sec">
              <h4>Good to know</h4>
              {(named.length > 0 || row.typicallyOffered) && (
                <div className="course-page-tags">
                  {named.map((a) => (
                    <span key={a} className="course-page-tag">
                      {a}
                    </span>
                  ))}
                  {row.typicallyOffered && (
                    <span className="course-page-tag">Usually offered {row.typicallyOffered.replace(/^the /, "")}</span>
                  )}
                </div>
              )}
              {restriction.map((line) => (
                <p key={line} className="course-page-restriction">
                  {line}
                </p>
              ))}
              {otherAttrs.length > 0 && <p className="course-page-fine">Also tagged {otherAttrs.join(", ")} in the bulletin.</p>}
            </section>
          )}
        </article>
      </div>
      <footer className="course-page-foot">
        {row.completed ? (
          <p className="course-page-note">Completed. Taking it again won’t count.</p>
        ) : placement ? (
          <p className="course-page-note">In your plan. Add and drop on your plan.</p>
        ) : (
          <>
            {blocked && (
              <p className="course-page-note">
                Your shortlist is full ({SHORTLIST_MAX} of {SHORTLIST_MAX}). Remove one to add this.
              </p>
            )}
            <button
              type="button"
              className="course-page-btn"
              data-on={on || undefined}
              aria-disabled={blocked || undefined}
              onClick={() => {
                if (blocked) return;
                if (on) {
                  shortlist.remove(row.code);
                  onAnnounce(`${row.code} removed from your shortlist.`);
                } else {
                  shortlist.add(row.code);
                  onAnnounce(`${row.code} shortlisted. ${shortlist.count + 1} of ${SHORTLIST_MAX}.`);
                }
              }}
            >
              {on ? "Remove from shortlist" : "Shortlist"}
            </button>
          </>
        )}
      </footer>
    </>
  );
}
