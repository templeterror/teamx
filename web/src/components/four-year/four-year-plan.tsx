"use client";

import { useState, useSyncExternalStore } from "react";
import { bulletinYear, programs, type ProgramCode } from "@/data";
import { useProgram } from "@/components/student/student-context";
import {
  boardFor, courseTitle, totalCredits,
  COMPLETED, UNPLANNED, type Board, type Choice,
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

  function update(id: string, change: Partial<Choice>) {
    const current = readBoard();
    saveBoard({ ...current, [id]: { ...current[id], ...change } });
  }

  function renderTerm(id: string, label: string) {
    const items = cards.filter((card) => board[card.id].term === id);
    const canDrop = dragged !== null && (id !== COMPLETED || !!board[dragged].code);
    return (
      <section
        key={id}
        className="four-year-term"
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
          <span>{totalCredits(items)} cr</span>
        </header>
        {items.length === 0 && <p className="four-year-empty">Drop a course here</p>}
        {items.map((card) => {
          const { code } = board[card.id];
          const title = courseTitle(code) ?? card.label;
          const issue = issues.get(card.id);
          return (
            <details
              key={card.id}
              className="four-year-card"
              data-status={issue?.status}
              data-dragging={dragged === card.id || undefined}
            >
              <summary
                title="Open course options or drag to another term"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", code || card.label);
                  event.dataTransfer.effectAllowed = "move";
                  setDragged(card.id);
                }}
                onDragEnd={() => { setDragged(null); setDropTarget(null); }}
              >
                <span className="four-year-card-meta">
                  <span>{code || "Requirement slot"}</span>
                  <span>{totalCredits([card])} cr</span>
                </span>
                <span className="four-year-title">{title}</span>
                {issue && <span className="four-year-warning">
                  {issue.status === "missing" ? "Missing prerequisite" : "Check prerequisite"}
                </span>}
              </summary>
              <div className="four-year-controls">
                {issue && <p>{issue.raw}</p>}
                {card.options.length > 1 && (
                  <label>
                    Course option
                    <select value={code} onChange={(event) => update(card.id, { code: event.target.value })}>
                      {card.options.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </label>
                )}
                <label>
                  Move {code || card.label}
                  <select value={id} onChange={(event) => update(card.id, { term: event.target.value })}>
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
        <button className="btn empty four-year-reset" type="button" disabled={board === starterBoard}
          onClick={() => saveBoard(starterBoard)}>
          Reset to suggested plan
        </button>
      </div>

      <div className="four-year-overview">
        <div className="four-year-totals" aria-live="polite">
          <strong>{totalCredits(planned)} credits planned</strong>
          <span>{totalCredits(completed)} completed</span>
          <span data-status={missing ? "missing" : undefined}>
            {missing ? `${missing} prerequisite ${missing === 1 ? "warning" : "warnings"}` : "No missing prerequisites found"}
          </span>
          {unknown > 0 && <span>{unknown} to verify</span>}
        </div>
        <p>
          This sample plan includes elective slots in credit estimates. Check grades, placement,
          course availability, and degree requirements with your advisor before registering.
        </p>
      </div>

      <div className="four-year-layout">
        <div className="four-year-board">
          {years.map(({ year, terms }) => (
            <section key={year} aria-labelledby={`four-year-heading-${year}`}>
              <h2 id={`four-year-heading-${year}`}>Year {year}</h2>
              <div className="four-year-terms">
                {terms.map(({ id, term }) => renderTerm(id, term))}
              </div>
            </section>
          ))}
        </div>
        <aside className="four-year-tray" aria-label="Courses outside the timeline">
          {renderTerm(COMPLETED, "Already completed")}
          {renderTerm(UNPLANNED, "Unplanned")}
        </aside>
      </div>
    </div>
  );
}
