"use client";

import { useState, type ReactNode } from "react";
import type { DarsAudit, DarsCourse, DarsPart, DarsRequirement, DarsStatus } from "@/data";
import { ChevronIcon } from "./icons";

/*
 * The progress panel's "Degree audit" view: the student's DARS audit, requirement by
 * requirement, in the panel's own rows. What still needs something leads each section;
 * what is met folds behind the same "N more" toggle the Plan view uses.
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/* "2026-10-31" → "31 October 2026", as the record's source line words it. Spelled out by hand so server and client agree. */
function longDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return year && month && day ? `${day} ${MONTHS[month - 1]} ${year}` : iso;
}

/* Needs first, then in progress, then met; the audit's own order inside each. */
const RANK: Record<DarsStatus, number> = { needs: 0, "in-progress": 1, met: 2 };

/* "Needs 1 course"; a requirement of parts without its own count says how many parts are open. */
function statusText(status: DarsStatus, needs: string | undefined, parts?: DarsPart[]): ReactNode {
  if (status === "met") return "Met";
  if (status === "in-progress") return <><i data-seg="progress" aria-hidden="true" />In progress</>;
  if (needs) return `Needs ${needs}`;
  if (parts?.length) {
    const open = parts.filter((part) => part.status === "needs").length;
    return <>Needs {open} of {parts.length} parts</>;
  }
  return "Needs";
}

/* "56 credits earned · 33 in progress · 34 needed": the unit rides on the first figure. */
function summaryText(summary: NonNullable<DarsRequirement["summary"]>) {
  const figures = [
    summary.earned !== undefined && ["earned", summary.earned] as const,
    summary.inProgress !== undefined && ["in progress", summary.inProgress] as const,
    summary.needs !== undefined && ["needed", summary.needs] as const,
  ].filter((figure) => figure !== false);
  return figures.map(([word, count], index) => {
    const unit = index === 0 ? ` ${count === 1 ? summary.unit.replace(/s$/, "") : summary.unit}` : "";
    return `${count}${unit} ${word}`;
  }).join(" · ");
}

function CourseLines({ courses }: { courses: DarsCourse[] }) {
  return (
    <ul className="fy-req-courses fy-dars-courses">
      {courses.map((course) => (
        <li key={`${course.term}-${course.code}`}>
          <i data-seg={course.inProgress ? "progress" : "done"} aria-hidden="true" />
          <span className="fy-dars-course">
            <span>
              {course.term} · <span className="fy-req-code">{course.code}</span> · {course.title}
              {course.inProgress && <span className="fy-sr">, in progress</span>}
            </span>
            {course.satisfies && <span className="fy-dars-sub">satisfies {course.satisfies}</span>}
          </span>
          <span className="fy-req-term">{course.credits} cr</span>
        </li>
      ))}
    </ul>
  );
}

function PartBlock({ part }: { part: DarsPart }) {
  return (
    <li className="fy-dars-part" data-status={part.status}>
      <div className="fy-dars-part-head">
        <span className="fy-dars-part-label">{part.label}</span>
        <span className="fy-dars-status">{statusText(part.status, part.needs)}</span>
      </div>
      {part.courses && part.courses.length > 0 && <CourseLines courses={part.courses} />}
      {part.selectFrom && <p className="fy-req-note">Choose from {part.selectFrom}</p>}
      {part.note && <p className="fy-req-note">{part.note}</p>}
    </li>
  );
}

export function DarsAuditView({ dars }: { dars: DarsAudit }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [shownSections, setShownSections] = useState<Set<number>>(() => new Set());

  function toggleIn<T>(set: (update: (previous: Set<T>) => Set<T>) => void, id: T) {
    set((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderRow(row: DarsRequirement, sectionIndex: number) {
    const key = `${sectionIndex}-${row.id}`;
    const isOpen = open.has(key);
    const exceptionNote = row.byException && !row.note ? "Met by a DARS exception." : null;
    const expandable = Boolean(row.courses?.length || row.parts?.length || row.selectFrom || row.note || exceptionNote);
    const bodyId = `fy-dars-${key.replace(/[^a-z0-9]+/gi, "-")}`;
    const label = (
      <span className="fy-req-label">
        {row.title}
        {/* Figures ride in the head only when there is nothing to open (Total hours); otherwise they lead the body. */}
        {row.summary && !expandable && <span className="fy-dars-summary">{summaryText(row.summary)}</span>}
      </span>
    );
    const status = <span className="fy-req-status fy-dars-status">{statusText(row.status, row.needs, row.parts)}</span>;
    return (
      <li key={key} className="fy-req fy-dars-req" data-status={row.status} data-open={isOpen || undefined}>
        {expandable
          ? (
            <button type="button" className="fy-req-head" aria-expanded={isOpen} aria-controls={bodyId}
              onClick={() => toggleIn(setOpen, key)}>
              {label}
              {status}
              <ChevronIcon />
            </button>
          )
          : <div className="fy-req-head" data-static="">{label}{status}</div>}
        {expandable && isOpen && (
          <div className="fy-req-body" id={bodyId}>
            {row.summary && <p className="fy-req-note fy-num">{summaryText(row.summary)}</p>}
            {row.parts && row.parts.length > 0 && (
              <ul className="fy-dars-parts">
                {row.parts.map((part, index) => <PartBlock key={`${part.label}-${index}`} part={part} />)}
              </ul>
            )}
            {row.courses && row.courses.length > 0 && <CourseLines courses={row.courses} />}
            {row.selectFrom && <p className="fy-req-note">Choose from {row.selectFrom}</p>}
            {(row.note || exceptionNote) && <p className="fy-req-note">{row.note || exceptionNote}</p>}
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="fy-dars">
      <p className="fy-dars-source">From DARS, prepared {longDate(dars.prepared)} · {dars.catalog} catalog</p>
      <div className="fy-groups">
        {dars.sections.map((section, index) => {
          const rows = [...section.requirements].sort((a, b) => RANK[a.status] - RANK[b.status]);
          /* "Free electives" holding one "Free electives" row: the row is its own heading. */
          const solo = rows.length === 1 && rows[0].title.toLowerCase() === section.title.toLowerCase();
          const expanded = solo || shownSections.has(index);
          const pending = rows.filter((row) => row.status !== "met");
          const visible = expanded ? rows : pending;
          const hidden = rows.length - pending.length;
          const headId = `fy-dars-section-${index}`;
          return (
            <section key={section.title} className="fy-group"
              {...(solo ? { "aria-label": section.title } : { "aria-labelledby": headId })}>
              {!solo && <h3 id={headId} className="fy-group-head">{section.title}</h3>}
              {visible.length > 0 && (
                <ul className="fy-reqs">
                  {visible.map((row) => renderRow(row, index))}
                </ul>
              )}
              {!solo && hidden > 0 && (
                <button type="button" className="fy-group-more" aria-expanded={expanded}
                  onClick={() => toggleIn(setShownSections, index)}>
                  {expanded ? "Show only what’s left" : `${hidden} more met`}
                  <ChevronIcon />
                </button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
