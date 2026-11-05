"use client";

import { useState, useSyncExternalStore } from "react";
import { bulletinYear, programs, type ProgramCode } from "@/data";
import { useProgram } from "@/components/student/student-context";
import {
  boardFor, courseTitle, totalCredits,
  COMPLETED, UNPLANNED, type Board, type Card, type Choice, type Kind,
} from "./board";
import "./four-year.css";

/* One saved board per program, so the CS and MIS students never share a timeline. */
type BoardStore = {
  read: () => Board;
  save: (board: Board) => void;
  subscribe: (listener: () => void) => () => void;
};
const STORES = new Map<ProgramCode, BoardStore>();

function storeFor(program: ProgramCode): BoardStore {
  const existing = STORES.get(program);
  if (existing) return existing;

  const { plan, readSavedBoard, starterBoard } = boardFor(program);
  const STORAGE_KEY = `course-planner:four-year:${plan.program}:${bulletinYear}`;
  let boardCache: Board | undefined;
  const listeners = new Set<() => void>();

  function readBoard() {
    if (boardCache) return boardCache;
    try {
      boardCache = readSavedBoard(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null"));
    } catch {
      boardCache = starterBoard;
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

function Chevron() {
  return (
    <svg className="four-year-chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* A saved board is a fresh object even when nothing moved, so compare what each card holds. */
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
  const { years, terms, cards, starterBoard, sequenceIssues } = boardFor(program);
  const { read: readBoard, save: saveBoard, subscribe } = storeFor(program);
  const board = useSyncExternalStore(subscribe, readBoard, () => starterBoard);
  const [dragged, setDragged] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const issues = sequenceIssues(board);
  const missing = [...issues.values()].filter(({ status }) => status === "missing").length;
  const unknown = issues.size - missing;
  const planned = cards.filter(({ id }) => board[id].term !== UNPLANNED && board[id].term !== COMPLETED);
  const completed = cards.filter(({ id }) => board[id].term === COMPLETED);
  const kinds = KIND_ORDER.filter((kind) => cards.some((card) => card.kind === kind));
  const hasSlots = cards.some((card) => card.slot);
  /* One Summer width for every year, so Fall and Spring edges line up down the page. */
  const summerFilled = cards.some((card) => board[card.id].term.endsWith("-Summer"));

  function update(id: string, change: Partial<Choice>) {
    const current = readBoard();
    saveBoard({ ...current, [id]: { ...current[id], ...change } });
  }

  function renderTerm(id: string, label: string, season?: string) {
    const items = cards.filter((card) => board[card.id].term === id);
    const canDrop = dragged !== null && (id !== COMPLETED || !!board[dragged].code);
    const summer = season === "Summer";
    return (
      <section
        key={id}
        className="four-year-term"
        data-summer={summer || undefined}
        data-empty={items.length === 0 || undefined}
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
          <h3>{label}</h3>
          {items.length > 0 && <span>{totalCredits(items)} cr</span>}
        </header>
        {items.length === 0 && (
          <p className="four-year-empty">
            {summer ? "Optional" : "Drag a course here, or open a course to move it"}
          </p>
        )}
        {items.map((card) => {
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
                  <select value={id} aria-label={`Term for ${name}`}
                    onChange={(event) => update(card.id, { term: event.target.value })}>
                    {terms.map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}
                    {code && <option value={COMPLETED}>Already completed</option>}
                    <option value={UNPLANNED}>Unplanned</option>
                  </select>
                </label>
              </div>
            </details>
          );
        })}
      </section>
    );
  }

  return (
    <div className="four-year">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">{programHeading(program)} · {bulletinYear} bulletin</p>
          <h1>Four-year plan</h1>
          <p className="intro">Drag a course between terms or open it to move it or mark it as completed.</p>
        </div>
        <button className="btn empty four-year-reset" type="button" disabled={sameBoard(board, starterBoard)}
          onClick={() => saveBoard(starterBoard)}>
          Reset to suggested plan
        </button>
      </div>

      <div className="four-year-overview">
        <div className="four-year-stats" aria-live="polite">
          <p><strong>{totalCredits(planned)}</strong> credits planned</p>
          <p><strong>{totalCredits(completed)}</strong> completed</p>
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
          {years.map(({ year, terms: yearTerms }) => {
            const ids = new Set(yearTerms.map(({ id }) => id));
            const yearCards = cards.filter((card) => ids.has(board[card.id].term));
            return (
              <section key={year} aria-labelledby={`four-year-heading-${year}`}>
                <header className="four-year-year-header">
                  <h2 id={`four-year-heading-${year}`}>Year {year}</h2>
                  <span>{totalCredits(yearCards)} credits</span>
                </header>
                <div className="four-year-terms">
                  {yearTerms.map(({ id, term }) => renderTerm(id, term, term))}
                </div>
              </section>
            );
          })}
        </div>
        <aside className="four-year-tray" aria-label="Courses outside the timeline">
          {renderTerm(COMPLETED, "Already completed")}
          {renderTerm(UNPLANNED, "Unplanned")}
        </aside>
      </div>
    </div>
  );
}
