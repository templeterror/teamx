"use client";

/*
 * Find courses, the Bar finder at full height on the Find page (productthink.md,
 * "Course finder" and "Finding courses is its own page").
 * A search field, the "Counts for" scope chips with live counts, Ask AI, then the
 * course table. The only verb is Shortlist; Add and Drop stay on the plan.
 * Rows in the plan say "In your plan", completed rows "Completed", and at 10 of 10
 * Shortlist disables. The course cell opens the Drill-in (onOpen).
 * Every class is `finder-` prefixed.
 */

import { useEffect, useId, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import type { Offering } from "@/components/plan/data";
import {
  OPEN_GENED,
  SCOPES,
  SUBJECTS,
  formatCredits,
  scopeCounts,
  scopeRows,
  searchRows,
  type FinderRow,
  type Scope,
} from "./catalog";
import { SHORTLIST_MAX, type Shortlist } from "@/components/plan/use-shortlist";
import "./finder.css";

const LEVELS = ["1000", "2000", "3000", "4000"];
const ATTRIBUTES = [
  { id: "WI", label: "Writing intensive" },
  { id: "HO", label: "Honors" },
];
const DAY_SETS = [
  { id: "MWF", label: "Mon Wed Fri", days: ["Mon", "Wed", "Fri"] },
  { id: "TTh", label: "Tue Thu", days: ["Tue", "Thu"] },
];

const KIND_ORDER: Record<FinderRow["countsFor"]["kind"], number> = {
  "major-elective": 0,
  gened: 1,
  core: 2,
  free: 3,
};

function shortRestriction(r: string | null): string | null {
  if (!r) return null;
  if (/Cohorts?/.test(r) && /HONORS/.test(r)) return "Honors cohorts only";
  if (/Must be enrolled in one of the following Classes: Freshman/.test(r)) return "First-year students only";
  if (/May not be enrolled in one of the following Classes: Freshman/.test(r)) return "Not open to first-year students";
  if (/Must be enrolled in one of the following Fields of study/.test(r)) return "Listed majors only";
  if (/May not be enrolled/.test(r)) return "Not open to some majors";
  return "Enrollment restricted";
}

/* "Tue Thu 2:00–3:20 pm". Meridiem once when both ends share it. */
function meeting(o: Offering): string {
  if (!o.days.length) return "Time to be announced";
  const clock = (m: number) => `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, "0")}`;
  const mer = (m: number) => (m < 720 ? "am" : "pm");
  const range =
    mer(o.start) === mer(o.end)
      ? `${clock(o.start)}–${clock(o.end)} ${mer(o.end)}`
      : `${clock(o.start)} ${mer(o.start)}–${clock(o.end)} ${mer(o.end)}`;
  return `${o.days.join(" ")} ${range}`;
}

function conflictText(names: string[]): string {
  if (names.length <= 2) return `Conflicts with ${names.join(" and ")}`;
  return `Conflicts with ${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

function needsText(needs: { code: string }[]): string {
  const codes = needs.map((n) => n.code);
  if (!codes.length) return "Check prerequisites";
  const head = codes.slice(0, 2).join(" or ");
  return codes.length > 2 ? `Needs ${head} +${codes.length - 2}` : `Needs ${head}`;
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

function countSentence(n: number, scope: Scope, query: string): string {
  const noun = plural(n, "course", "courses");
  const verb = plural(n, "counts", "count");
  if (scope === "major-elective") return `${n} ${noun} ${verb} as a major elective`;
  if (scope === "gened") return `${n} ${noun} ${verb} toward ${OPEN_GENED.label}`;
  if (scope === "free") return `${n} ${noun} ${verb} as a free elective`;
  return query.trim() ? `${n} ${noun} ${plural(n, "matches", "match")}` : `${n} ${noun}`;
}

function Icon({ name, size = 16 }: { name: "search" | "close" | "chevron" | "open" | "check" | "add"; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "search" ? (
        <>
          <circle cx="7" cy="7" r="4.25" />
          <path d="m10.25 10.25 3 3" />
        </>
      ) : name === "close" ? (
        <path d="m4.5 4.5 7 7m0-7-7 7" />
      ) : name === "chevron" ? (
        <path d="m4 6 4 4 4-4" />
      ) : name === "open" ? (
        <path d="m6 4 4 4-4 4" />
      ) : name === "check" ? (
        <path d="m3.5 8.5 3 3 6-7" />
      ) : (
        <path d="M4 8h8M8 4v8" />
      )}
    </svg>
  );
}

export type FinderProps = {
  rows: FinderRow[];
  initialScope: Scope;
  shortlist: Shortlist;
  /* The row the mini week is previewing (from here or from the shortlist). */
  previewCode: string | null;
  onPreview: (code: string | null, via: "hover" | "focus") => void;
  /* Opens the Drill-in in the right column; the opener gets focus back. */
  onOpen: (code: string, opener: HTMLElement) => void;
  openCode: string | null;
  /* One line of scope context above the table ("For: Major electives · 2 to choose"), for the chosen chip. */
  context?: ((scope: Scope) => string) | null;
};

export function Finder({
  rows,
  initialScope,
  shortlist,
  previewCode,
  onPreview,
  onOpen,
  openCode,
  context = null,
}: FinderProps) {
  const uid = useId();
  const inputId = `${uid}-q`;
  const tableId = `${uid}-table`;
  const moreId = `${uid}-more`;
  const aiId = `${uid}-ai`;

  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>(initialScope);
  const [moreOpen, setMoreOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("");
  const [attribute, setAttribute] = useState("");
  const [days, setDays] = useState("");
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [fitsOnly, setFitsOnly] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState("");
  const [notice, setNotice] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const daySet = DAY_SETS.find((d) => d.id === days);
    return rows.filter((r) => {
      if (subject && r.subject !== subject) return false;
      if (level && Number(r.number) < Number(level)) return false;
      if (attribute && !r.attributes.includes(attribute)) return false;
      if (daySet && !(r.offering.days.length && r.offering.days.every((d) => daySet.days.includes(d))))
        return false;
      if (eligibleOnly && (r.completed || r.eligibility.status !== "met")) return false;
      if (fitsOnly && r.fit.status !== "fits") return false;
      return true;
    });
  }, [rows, subject, level, attribute, days, eligibleOnly, fitsOnly]);

  const matched = useMemo(() => {
    if (query.trim()) return searchRows(filtered, query);
    return [...filtered].sort(
      (a, b) => KIND_ORDER[a.countsFor.kind] - KIND_ORDER[b.countsFor.kind] || a.code.localeCompare(b.code),
    );
  }, [filtered, query]);

  const counts = useMemo(() => scopeCounts(matched), [matched]);
  const visible = useMemo(() => scopeRows(matched, scope), [matched, scope]);
  const fitCount = useMemo(() => visible.filter((r) => r.fit.status === "fits").length, [visible]);

  const secondary = [
    subject && { key: "subject", label: subject, clear: () => setSubject("") },
    level && { key: "level", label: `${level} and above`, clear: () => setLevel("") },
    attribute && {
      key: "attribute",
      label: ATTRIBUTES.find((a) => a.id === attribute)?.label ?? attribute,
      clear: () => setAttribute(""),
    },
    days && { key: "days", label: DAY_SETS.find((d) => d.id === days)?.label ?? days, clear: () => setDays("") },
    eligibleOnly && { key: "eligible", label: "Eligible only", clear: () => setEligibleOnly(false) },
    fitsOnly && { key: "fits", label: "Fits my week", clear: () => setFitsOnly(false) },
  ].filter((x): x is { key: string; label: string; clear: () => void } => !!x);

  const applied = [
    ...(scope !== "all"
      ? [{ key: "scope", label: SCOPES.find((s) => s.id === scope)?.label ?? "", clear: () => setScope("all") }]
      : []),
    ...secondary,
  ];

  function previewFocus(code: string) {
    return {
      onFocus: () => onPreview(code, "focus"),
      onBlur: (e: FocusEvent<HTMLElement>) => {
        const next = e.relatedTarget as HTMLElement | null;
        if (!next?.closest(`[data-preview-code="${code}"]`)) onPreview(null, "focus");
      },
    };
  }

  function focusInput() {
    inputRef.current?.focus();
  }

  function clearAll() {
    setQuery("");
    setScope("all");
    setSubject("");
    setLevel("");
    setAttribute("");
    setDays("");
    setEligibleOnly(false);
    setFitsOnly(false);
    focusInput();
  }

  /* Fade the chip strip's edge only when it actually overflows on that side. */
  useEffect(() => {
    const el = chipsRef.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      el.toggleAttribute("data-fade-start", el.scrollLeft > 1);
      el.toggleAttribute("data-fade-end", max > 1 && el.scrollLeft < max - 1);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [counts, secondary.length]);

  function onRootKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key !== "Escape" || !aiOpen) return;
    e.preventDefault();
    setAiOpen(false);
  }

  function pickScope(id: Scope) {
    setScope((current) => (current === id && id !== "all" ? "all" : id));
  }

  /* ---- Shortlist: the page's one verb ---- */

  function action(row: FinderRow) {
    if (row.completed) return <span className="finder-row-note">Completed</span>;
    if (row.inPlan) return <span className="finder-row-note">In your plan</span>;
    const on = shortlist.has(row.code);
    if (on)
      return (
        <button
          type="button"
          className="finder-shortlist"
          data-on=""
          aria-label={`Shortlisted: remove ${row.code} from shortlist`}
          onClick={() => {
            shortlist.remove(row.code);
            setNotice(`${row.code} removed from your shortlist. ${shortlist.count - 1} of ${SHORTLIST_MAX}.`);
          }}
        >
          Shortlisted
          <span className="finder-shortlist-icon" aria-hidden="true">
            <span className="finder-shortlist-check">
              <Icon name="check" size={14} />
            </span>
            <span className="finder-shortlist-x">
              <Icon name="close" size={13} />
            </span>
          </span>
        </button>
      );
    const blocked = shortlist.full;
    return (
      <button
        type="button"
        className="finder-shortlist"
        aria-disabled={blocked || undefined}
        title={blocked ? `Your shortlist is full (${SHORTLIST_MAX} of ${SHORTLIST_MAX})` : undefined}
        aria-label={`Shortlist ${row.code} ${row.title}${blocked ? `. Shortlist is full, ${SHORTLIST_MAX} of ${SHORTLIST_MAX}` : ""}`}
        onClick={() => {
          if (blocked) return;
          shortlist.add(row.code);
          setNotice(`${row.code} shortlisted. ${shortlist.count + 1} of ${SHORTLIST_MAX}.`);
        }}
      >
        Shortlist
      </button>
    );
  }

  function eligibility(row: FinderRow) {
    const restriction = shortRestriction(row.restriction);
    let main;
    if (row.completed) main = <span data-tone="muted">Completed</span>;
    else if (row.inPlan) main = <span data-tone="plan">In your plan</span>;
    else if (row.eligibility.status === "met") main = <span data-tone="ok">Prereqs met</span>;
    else if (row.eligibility.status === "missing") main = <span data-tone="needs">{needsText(row.eligibility.needs)}</span>;
    else main = <span data-tone="muted">Check prerequisites</span>;
    return (
      <span className="finder-elig">
        {main}
        {restriction && !row.completed && <small>{restriction}</small>}
      </span>
    );
  }

  function fit(row: FinderRow) {
    const when = meeting(row.offering);
    if (row.completed)
      return (
        <span className="finder-fit" aria-label="Not applicable">
          —
        </span>
      );
    if (row.inPlan)
      return (
        <span className="finder-fit" title={`In your week · ${when}`}>
          <b data-tone="plan">In your week</b> · {when}
        </span>
      );
    if (row.fit.status === "conflict") {
      const text = conflictText(row.fit.with.map((w) => w.title));
      return (
        <span className="finder-fit" data-tone="conflict" title={text}>
          {text}
        </span>
      );
    }
    return (
      <span className="finder-fit" title={`Fits · ${when}`}>
        <b data-tone="ok">Fits</b> · {when}
      </span>
    );
  }

  function countsFor(row: FinderRow) {
    return (
      <span className="finder-kind" data-kind={row.countsFor.kind}>
        {row.countsFor.kind !== "free" && <i className="finder-swatch" aria-hidden="true" />}
        {row.countsFor.label}
      </span>
    );
  }

  const hasQuery = query.trim().length > 0;

  return (
    <section className="finder" aria-labelledby={`${uid}-title`} onKeyDown={onRootKeyDown}>
      <div className="finder-head">
        <h2 id={`${uid}-title`} className="finder-title">
          <label htmlFor={inputId}>Find courses</label>
        </h2>
        {context && (
          <p className="finder-context" title={context(scope)}>
            {context(scope)}
          </p>
        )}
        <span className="finder-note">Meeting times are samples</span>
      </div>

      <div className="finder-card">
        <div className="finder-row">
          <form role="search" className="finder-form" onSubmit={(e) => e.preventDefault()}>
            <span className="finder-search-icon">
              <Icon name="search" />
            </span>
            <input
              ref={inputRef}
              id={inputId}
              className="finder-input"
              type="search"
              placeholder="Find courses by code, title, or topic"
              autoComplete="off"
              spellCheck={false}
              aria-controls={tableId}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  tableRef.current?.querySelector<HTMLButtonElement>(".finder-course")?.focus();
                }
              }}
            />
            {query && (
              <button
                type="button"
                className="finder-clear"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </form>

          <div ref={chipsRef} className="finder-chips" role="group" aria-label="Counts for">
            {SCOPES.map((s) => (
              <button
                key={s.id}
                type="button"
                className="finder-chip"
                data-kind={s.id}
                aria-pressed={scope === s.id}
                onClick={() => pickScope(s.id)}
              >
                {(s.id === "major-elective" || s.id === "gened") && (
                  <i className="finder-swatch" aria-hidden="true" />
                )}
                {s.label}
                <span className="finder-chip-count">{counts[s.id]}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="finder-quiet"
            aria-expanded={aiOpen}
            aria-controls={aiId}
            onClick={() => setAiOpen((v) => !v)}
          >
            Ask AI
          </button>
        </div>

        {aiOpen && (
          <form id={aiId} className="finder-ai" onSubmit={(e) => e.preventDefault()}>
            <label htmlFor={`${aiId}-text`}>Ask about courses</label>
            <textarea
              id={`${aiId}-text`}
              rows={2}
              value={aiText}
              placeholder="An elective that fits around my required courses"
              onChange={(e) => setAiText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") e.preventDefault();
              }}
            />
            <small>AI preview · not connected</small>
          </form>
        )}

        <div className="finder-body">
          <div className="finder-applied">
            {applied.length > 0 && (
              <ul className="finder-applied-list" aria-label="Applied filters">
                {applied.map((a) => (
                  <li key={a.key}>
                    <button
                      type="button"
                      className="finder-applied-chip"
                      aria-label={`Remove filter: ${a.label}`}
                      onClick={() => {
                        a.clear();
                        focusInput();
                      }}
                    >
                      {a.label}
                      <Icon name="close" size={12} />
                    </button>
                  </li>
                ))}
                <li>
                  <button type="button" className="finder-text-btn" onClick={clearAll}>
                    Clear all
                  </button>
                </li>
              </ul>
            )}
            <p className="finder-count" aria-live="polite">
              {countSentence(visible.length, scope, query)}
              {visible.length > 0 && (
                <>
                  {" · "}
                  {fitCount} {plural(fitCount, "fits", "fit")} your week
                </>
              )}
            </p>
            <div className="finder-more">
              <button
                type="button"
                className="finder-more-toggle"
                aria-expanded={moreOpen}
                aria-controls={moreId}
                onClick={() => setMoreOpen((v) => !v)}
              >
                More filters
                {secondary.length > 0 && <span className="finder-chip-count">{secondary.length}</span>}
                <Icon name="chevron" size={14} />
              </button>
            </div>
          </div>

          {moreOpen && (
            <div id={moreId} className="finder-more-panel">
              <label className="finder-field">
                Subject
                <select value={subject} onChange={(e) => setSubject(e.target.value)}>
                  <option value="">All subjects</option>
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="finder-field">
                Level
                <select value={level} onChange={(e) => setLevel(e.target.value)}>
                  <option value="">Any level</option>
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l} and above
                    </option>
                  ))}
                </select>
              </label>
              <label className="finder-field">
                Attribute
                <select value={attribute} onChange={(e) => setAttribute(e.target.value)}>
                  <option value="">Any attribute</option>
                  {ATTRIBUTES.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="finder-field">
                Days
                <select value={days} onChange={(e) => setDays(e.target.value)}>
                  <option value="">Any days</option>
                  {DAY_SETS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="finder-check">
                <input type="checkbox" checked={eligibleOnly} onChange={(e) => setEligibleOnly(e.target.checked)} />
                Eligible only
              </label>
              <label className="finder-check">
                <input type="checkbox" checked={fitsOnly} onChange={(e) => setFitsOnly(e.target.checked)} />
                Fits my week
              </label>
            </div>
          )}

          <div ref={tableRef} id={tableId} className="finder-scroll" tabIndex={-1}>
            {visible.length ? (
              <table className="finder-table">
                <thead>
                  <tr>
                    <th scope="col">Course</th>
                    <th scope="col" className="finder-num">
                      Credits
                    </th>
                    <th scope="col">Counts for</th>
                    <th scope="col">Eligibility</th>
                    <th scope="col">Fit</th>
                    <th scope="col">
                      <span className="finder-sr">Shortlist</span>
                    </th>
                  </tr>
                </thead>
                <tbody onPointerLeave={() => onPreview(null, "hover")}>
                  {visible.map((row) => (
                    <tr
                      key={row.code}
                      className="finder-tr"
                      data-completed={row.completed || undefined}
                      data-previewing={previewCode === row.code || openCode === row.code || undefined}
                      data-shortlisted={shortlist.has(row.code) || undefined}
                      data-preview-code={row.code}
                      onPointerEnter={() => onPreview(row.code, "hover")}
                      {...previewFocus(row.code)}
                    >
                      <td className="finder-td-course">
                        <button
                          type="button"
                          className="finder-course"
                          aria-label={`${row.code} ${row.title}. Open course details`}
                          onClick={(e) => onOpen(row.code, e.currentTarget)}
                        >
                          <span className="finder-code">{row.code}</span>
                          <span className="finder-ctitle">{row.title}</span>
                          <span className="finder-chev">
                            <Icon name="open" size={14} />
                          </span>
                        </button>
                        <span className="finder-mobile-meta">
                          {formatCredits(row.credits)} · {countsFor(row)} · {eligibility(row)}
                          <span className="finder-mobile-fit">{fit(row)}</span>
                        </span>
                      </td>
                      <td className="finder-num finder-td-meta">{row.credits === null ? "Variable" : row.credits}</td>
                      <td className="finder-td-meta">{countsFor(row)}</td>
                      <td className="finder-td-meta">{eligibility(row)}</td>
                      <td className="finder-td-meta">{fit(row)}</td>
                      <td className="finder-td-action">{action(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="finder-empty">
                <h3>{hasQuery ? `No courses match ‘${query.trim()}’` : "No courses match these filters"}</h3>
                <p>Try a code like CIS 3203, or clear the scope.</p>
                <button type="button" className="finder-btn" onClick={clearAll}>
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="finder-foot">
            <span>
              Showing {visible.length} {plural(visible.length, "course", "courses")}
            </span>
            <p role="status" className="finder-status">
              {notice}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
