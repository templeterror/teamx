"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { bulletinYear, programs, type ProgramCode } from "@/data";
import { useProgram } from "@/components/student/student-context";
import { usePlanContext } from "@/components/plan/plan-shell";
import {
  boardFor, courseTitle, totalCredits,
  COMPLETED, UNPLANNED, USED,
  type Board, type BoardTerm, type Card, type Choice, type Kind, type LockedCourse,
} from "./board";
import "./four-year.css";

/*
 * One saved board per program, so the CS and MIS students never share a timeline. It holds
 * only the student's moves; the record and this term's plan decide the rest (board.ts).
 */
type BoardStore = {
  read: () => Board;
  save: (board: Board) => void;
  subscribe: (listener: () => void) => () => void;
};
const STORES = new Map<ProgramCode, BoardStore>();
/* Nothing moved yet: the server's render, and the board after Reset. */
const NO_MOVES: Board = {};

function storeFor(program: ProgramCode): BoardStore {
  const existing = STORES.get(program);
  if (existing) return existing;

  const { plan, readSavedBoard } = boardFor(program);
  /* v2: boards saved before the record was applied could hold cards in terms now locked. */
  const STORAGE_KEY = `course-planner:four-year:v2:${plan.program}:${bulletinYear}`;
  let boardCache: Board | undefined;
  const listeners = new Set<() => void>();

  function readBoard() {
    if (boardCache) return boardCache;
    try {
      boardCache = readSavedBoard(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null"));
    } catch {
      boardCache = NO_MOVES;
    }
    return boardCache;
  }

  function saveBoard(board: Board) {
    boardCache = board;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
    } catch {
      /* Keep edits in memory if browser storage is disabled. */
    }
    for (const listener of listeners) listener();
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }

  const store = { read: readBoard, save: saveBoard, subscribe };
  STORES.set(program, store);
  return store;
}

/* "Computer Science BS": the program's name and the degree letters its code ends with. */
function programHeading(program: ProgramCode) {
  return `${programs[program].degree.program.name} ${program.split("-").at(-1)}`;
}

/* Legend names, as on the plan's week legend. */
const KIND_LABEL: Record<Kind, string> = {
  core: "Core",
  elective: "Elective",
  gened: "Gen ed",
  "free-elective": "Free elective",
};
const KIND_ORDER: Kind[] = ["core", "elective", "gened", "free-elective"];

const STATUS_LABEL: Record<LockedCourse["status"], string> = {
  completed: "Completed",
  "in-progress": "In progress",
  current: "On Your plan",
};

function Chevron() {
  return (
    <svg className="four-year-chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* A board is a fresh object even when nothing moved, so compare what each card holds. */
function sameBoard(a: Board, b: Board) {
  return Object.keys(b).every((id) => a[id]?.term === b[id].term && a[id]?.code === b[id].code);
}

/*
 * An elective slot's row label only repeats its eyebrow ("CS elective" over "Computer
 * Science elective"), so say what to do instead. Gen ed and lab science labels add detail.
 */
function slotTitle(card: Card) {
  const elective = card.kind === "elective" || card.kind === "free-elective";
  return elective && card.label.toLowerCase().includes("elective") ? "Choose a course" : card.label;
}

export function FourYearPlan() {
  const program = useProgram();
  const {
    hasRecord, years, openTerms, cards,
    currentFromPlan, derive, resolve, sequenceIssues,
  } = boardFor(program);
  const { placements } = usePlanContext();
  /* The plan lives in the workspace layout, so a drop on /plan is already gone here. */
  const derived = derive(currentFromPlan(placements));
  const { read: readBoard, save: saveBoard, subscribe } = storeFor(program);
  const saved = useSyncExternalStore(subscribe, readBoard, () => NO_MOVES);
  const board = resolve(saved, derived);
  const { starter, locked, lockedByTerm, countsToward, fixed, met } = derived;
  const [dragged, setDragged] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const issues = sequenceIssues(board, derived);
  const missing = [...issues.values()].filter(({ status }) => status === "missing").length;
  const unknown = issues.size - missing;
  const termOf = (card: Card) => board[card.id].term;
  const onBoard = cards.filter((card) => termOf(card) !== USED);
  const planned = onBoard.filter((card) => termOf(card) !== UNPLANNED && termOf(card) !== COMPLETED);
  const completed = onBoard.filter((card) => termOf(card) === COMPLETED && !fixed.has(card.id));
  const unplanned = onBoard.filter((card) => termOf(card) === UNPLANNED);
  const kinds = KIND_ORDER.filter((kind) =>
    onBoard.some((card) => card.kind === kind) || locked.some((course) => course.kind === kind));
  const hasSlots = onBoard.some((card) => card.slot);
  /* One Summer width for every year, so Fall and Spring edges line up down the page. */
  const summerFilled = onBoard.some((card) => termOf(card).endsWith("-Summer"))
    || locked.some((course) => course.term.endsWith("-Summer"));

  function update(id: string, change: Partial<Choice>) {
    saveBoard({ ...readBoard(), [id]: { ...board[id], ...change } });
  }

  function renderCard(card: Card, termId: string) {
    const { code } = board[card.id];
    const title = courseTitle(code) ?? slotTitle(card);
    const issue = issues.get(card.id);
    const name = code || card.label;
    return (
      <details
        key={card.id}
        className="four-year-card"
        data-kind={card.kind}
        data-slot={card.slot ? "" : undefined}
        data-status={issue?.status}
        data-dragging={dragged === card.id || undefined}
      >
        <summary
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData("text/plain", name);
            event.dataTransfer.effectAllowed = "move";
            setDragged(card.id);
          }}
          onDragEnd={() => { setDragged(null); setDropTarget(null); }}
        >
          <span className="four-year-card-meta">
            <span className="four-year-code">{code || card.slot}</span>
            <span className="four-year-credits">{totalCredits([card])} cr</span>
            <Chevron />
          </span>
          <span className="four-year-title">{title}</span>
          {issue?.status === "missing" && <span className="four-year-warning">Missing prerequisite</span>}
        </summary>
        <div className="four-year-controls">
          {issue && (
            <p className="four-year-note" data-status={issue.status}>
              {issue.status === "missing" ? "Missing prerequisite: " : "Check with your advisor: "}
              {issue.raw}
            </p>
          )}
          {card.options.length > 1 && (
            <label>
              Course option
              <select value={code} onChange={(event) => update(card.id, { code: event.target.value })}>
                {card.options.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
          )}
          <label>
            Term
            <select value={termId} aria-label={`Term for ${name}`}
              onChange={(event) => update(card.id, { term: event.target.value })}>
              {openTerms.map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}
              {code && <option value={COMPLETED}>Already completed</option>}
              <option value={UNPLANNED}>{hasRecord ? "Still to place" : "Unplanned"}</option>
            </select>
          </label>
        </div>
      </details>
    );
  }

  /* A course from the record or this term's plan: it opens to facts, not controls. */
  function renderLockedCard(course: LockedCourse, term: BoardTerm) {
    const counts = countsToward.get(course.id);
    return (
      <details key={course.id} className="four-year-card" data-kind={course.kind} data-locked={course.status}>
        <summary>
          <span className="four-year-card-meta">
            <span className="four-year-code">{course.code}</span>
            <span className="four-year-credits">{course.credits} cr</span>
            <Chevron />
          </span>
          <span className="four-year-title">{course.title}</span>
        </summary>
        <dl className="four-year-controls four-year-facts">
          <div><dt>Status</dt><dd>{STATUS_LABEL[course.status]}</dd></div>
          <div><dt>Term</dt><dd>{term.name}</dd></div>
          <div><dt>Counts toward</dt><dd>{counts ? counts.label : "Beyond the suggested plan"}</dd></div>
        </dl>
      </details>
    );
  }

  /* A board term or a tray: a header over its cards, a drop target while it is open. */
  function renderColumn(
    id: string,
    heading: ReactNode,
    items: Card[],
    options: { summer?: boolean; helper?: string; after?: ReactNode } = {},
  ) {
    const canDrop = dragged !== null && (id !== COMPLETED || !!board[dragged].code);
    const empty = items.length === 0 && !options.after;
    return (
      <section
        key={id}
        className="four-year-term"
        data-summer={options.summer || undefined}
        data-empty={empty || undefined}
        data-drop-target={dropTarget === id || undefined}
        onDragOver={(event) => {
          if (!canDrop) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDropTarget(id);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null);
        }}
        onDrop={(event) => {
          if (!canDrop) return;
          event.preventDefault();
          update(dragged, { term: id });
          setDragged(null);
          setDropTarget(null);
        }}
      >
        <header className="four-year-term-header">
          <h3>{heading}</h3>
          {items.length > 0 && <span className="four-year-term-credits">{totalCredits(items)} cr</span>}
        </header>
        {options.helper && <p className="four-year-helper">{options.helper}</p>}
        {empty && (
          <p className="four-year-empty">
            {options.summer ? "Optional" : "Drag a course here, or open a course to move it"}
          </p>
        )}
        {items.map((card) => renderCard(card, id))}
        {options.after}
      </section>
    );
  }

  /* History or this term: no drop handlers, no hint, a status beside the name. */
  function renderLockedTerm(term: BoardTerm) {
    const courses = lockedByTerm.get(term.id) ?? [];
    return (
      <section
        key={term.id}
        className="four-year-term"
        data-locked={term.state}
        data-summer={term.season === "Summer" || undefined}
        data-empty={courses.length === 0 || undefined}
      >
        <header className="four-year-term-header">
          <h3>{term.name}</h3>
          {term.state === "current" && <span className="four-year-term-chip">This term</span>}
          {(term.state === "completed" || term.state === "in-progress") && (
            <span className="four-year-term-status">{term.state === "completed" ? "Completed" : "In progress"}</span>
          )}
          {courses.length > 0 && <span className="four-year-term-credits">{totalCredits(courses)} cr</span>}
        </header>
        {courses.length === 0 && (
          <p className="four-year-empty">{term.state === "current" ? "No courses on Your plan" : "No courses"}</p>
        )}
        {courses.map((course) => renderLockedCard(course, term))}
        {term.state === "current" && (
          <Link href="/plan" className="four-year-edit-link">
            Edit in Your plan
            <span aria-hidden="true">→</span>
          </Link>
        )}
      </section>
    );
  }

  function renderTerm(term: BoardTerm) {
    if (term.locked) return renderLockedTerm(term);
    const items = onBoard.filter((card) => termOf(card) === term.id);
    return renderColumn(term.id, term.name, items, { summer: term.season === "Summer" });
  }

  const sumWhere = (status: LockedCourse["status"][]) =>
    totalCredits(locked.filter((course) => status.includes(course.status)));

  return (
    <div className="four-year">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">{programHeading(program)} · {bulletinYear} bulletin</p>
          <h1>Four-year plan</h1>
          <p className="intro">
            {hasRecord
              ? "Terms you’ve taken come from your degree audit, and this term from Your plan. Drag what’s left between the terms ahead."
              : "Drag a course between terms or open it to move it or mark it as completed."}
          </p>
        </div>
        <button className="btn empty four-year-reset" type="button" disabled={sameBoard(board, starter)}
          onClick={() => saveBoard(NO_MOVES)}>
          Reset to suggested plan
        </button>
      </div>

      <div className="four-year-overview">
        <div className="four-year-stats" aria-live="polite">
          {hasRecord ? (
            <>
              <p><strong>{sumWhere(["completed"])}</strong> credits completed</p>
              <p><strong>{sumWhere(["in-progress", "current"])}</strong> in progress</p>
              <p><strong>{totalCredits([...planned, ...unplanned])}</strong> credits left to plan</p>
            </>
          ) : (
            <>
              <p><strong>{totalCredits(planned)}</strong> credits planned</p>
              <p><strong>{totalCredits(completed)}</strong> completed</p>
            </>
          )}
          <p data-status={missing ? "missing" : undefined}>
            <strong>{missing}</strong> missing {missing === 1 ? "prerequisite" : "prerequisites"}
          </p>
          <p><strong>{unknown}</strong> to verify</p>
        </div>
        <p className="four-year-disclaimer">
          Credit totals count open elective slots. Confirm the plan with your advisor before registering.
        </p>
      </div>

      <div className="four-year-legend">
        {kinds.map((kind) => (
          <span key={kind} className="four-year-legend-item">
            <i className="four-year-swatch" data-kind={kind} aria-hidden="true" />
            {KIND_LABEL[kind]}
          </span>
        ))}
        <span className="four-year-legend-item four-year-legend-break">
          <i className="four-year-swatch" data-shape="course" aria-hidden="true" />
          Course
        </span>
        {hasSlots && (
          <span className="four-year-legend-item">
            <i className="four-year-swatch" data-shape="slot" aria-hidden="true" />
            Open slot
          </span>
        )}
      </div>

      <div className="four-year-layout">
        <div className="four-year-board" data-summer={summerFilled ? "filled" : "empty"}>
          {years.map(({ year, span, terms: yearTerms }) => {
            const ids = new Set(yearTerms.map(({ id }) => id));
            const yearCredits = totalCredits([
              ...onBoard.filter((card) => ids.has(termOf(card))),
              ...locked.filter((course) => ids.has(course.term)),
            ]);
            return (
              <section key={year} aria-labelledby={`four-year-heading-${year}`}>
                <header className="four-year-year-header">
                  <h2 id={`four-year-heading-${year}`}>
                    Year {year}
                    {span && <span className="four-year-year-span"> · {span}</span>}
                  </h2>
                  <span>{yearCredits} credits</span>
                </header>
                <div className="four-year-terms">
                  {yearTerms.map(renderTerm)}
                </div>
              </section>
            );
          })}
        </div>
        <aside className="four-year-tray" aria-label="Courses outside the timeline">
          {renderColumn(COMPLETED, "Already completed", completed, {
            after: met.length > 0 && met.map((card) => (
              <div key={card.id} className="four-year-met" data-kind={card.kind}>
                <span className="four-year-met-note">Met another way</span>
                <span className="four-year-title">{card.label}</span>
              </div>
            )),
          })}
          {renderColumn(UNPLANNED, hasRecord ? "Still to place" : "Unplanned", unplanned, {
            helper: hasRecord ? "Requirements your record hasn’t covered yet. Drag each into a term." : undefined,
          })}
        </aside>
      </div>
    </div>
  );
}
