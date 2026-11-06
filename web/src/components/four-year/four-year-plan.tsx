"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { bulletinYear, programs, type ProgramCode } from "@/data";
import { graduationProgress, termOrder } from "@/components/progress/progress";
import { usePlanContext } from "@/components/plan/plan-shell";
import { useProfile } from "@/components/student/student-context";
import { usePreferences } from "@/components/onboarding/preferences";
import {
  academicYear, autoPlace, courseTitle, isSummer, modelFor, resolveBoard,
  CREDIT_MAX, CREDIT_MIN, PLACEHOLDER, TRAY,
  type Card, type HistoryTerm, type Issue, type RecordItem,
} from "./board";
import { useEdits } from "./edits";
import { AlertIcon, ChevronIcon, GripIcon, InfoIcon } from "./icons";
import { ProgressPanel } from "./progress-panel";
import "./four-year.css";

/* "Management Information Systems BBA": the program's name and the degree letters its code ends with. */
function programHeading(program: ProgramCode) {
  return `${programs[program].degree.program.name} ${program.split("-").at(-1)}`;
}

const STATUS_LABEL = {
  completed: "Completed",
  "in-progress": "In progress",
  registered: "Registered",
  current: "On Your plan",
} as const;

type DragState = { id: string; over: string | null; locked: boolean; width: number };

/* A pending press: becomes a drag once the pointer travels a few pixels. */
type Press = {
  id: string;
  pointerId: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  width: number;
  element: HTMLElement;
  active: boolean;
};

const DRAG_THRESHOLD = 5;
const EDGE = 72;

export function FourYearPlan() {
  const profile = useProfile();
  const { id: profileId, key, program, record } = profile;
  const prefs = usePreferences(key);
  /* A new student's board starts in the term they chose in setup; a record's starts where it does. */
  const model = modelFor(key, prefs.startTerm);
  const { edits, move, choose, clearMoves } = useEdits(profileId, program);
  const { placements } = usePlanContext();

  /* Rafiat's registered term is planned on /plan; the board shows it as it stands there. */
  const fromPlan = model.history.find((term) => term.fromPlan);
  const current: RecordItem[] = useMemo(() => fromPlan
    ? placements
        .filter((placement) => !placement.deferred && !placement.dropped)
        .map(({ kind, course }) => ({
          code: course.code,
          title: course.title,
          credits: course.credits,
          kind: model.fillsOf(course.code) ? model.kindOf(course.code) : kind,
          state: "registered" as const,
          fills: model.fillsOf(course.code),
        }))
    : [], [fromPlan, placements, model]);

  const prefsKey = `${prefs.graduationTerm}|${prefs.creditsPerTerm}|${prefs.summers}`;
  const auto = useMemo(
    () => autoPlace(model, prefs, edits.choices),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prefsKey stands for the three fields autoPlace reads
    [model, prefsKey, edits.choices],
  );
  const board = useMemo(
    () => resolveBoard(model, prefs, auto, edits.moves, current.map((course) => course.code)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as above
    [model, prefsKey, auto, edits.moves, current],
  );
  const progress = useMemo(() => {
    const recorded = new Set(model.record.terms.flatMap((term) => term.courses.map((course) => course.code)));
    const extra = fromPlan
      ? current.filter((course) => !recorded.has(course.code))
          .map((course) => ({ code: course.code, credits: course.credits, term: fromPlan.name }))
      : [];
    return graduationProgress(program, record, [...extra, ...board.placed]);
  }, [model, program, record, board.placed, current, fromPlan]);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  /* Terms ahead read as compact rows; "Edit" opens one into draggable cards. UI only, not saved. */
  const [editing, setEditing] = useState<ReadonlySet<string>>(() => new Set());
  const [announcement, setAnnouncement] = useState("");
  const press = useRef<Press | null>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const scrollFrame = useRef<number | null>(null);

  const cardById = useMemo(() => new Map(board.cards.map((card) => [card.id, card])), [board.cards]);
  const termOf = (card: Card) => board.placement[card.id];
  const hasMoves = Object.keys(edits.moves).length > 0;

  function moveCard(id: string, term: string) {
    const card = cardById.get(id);
    if (!card || board.placement[id] === term) return;
    move(id, term);
    setAnnouncement(`${card.code ?? card.fills} moved to ${term === TRAY ? "Still to place" : term}.`);
  }

  function chooseCourse(card: Card, code: string) {
    const term = termOf(card);
    choose(card.id, code, term === TRAY ? undefined : term);
    setAnnouncement(`${code} chosen for ${card.fills}.`);
    /* The picker goes away with the choice; keep keyboard focus on the card it was in. */
    requestAnimationFrame(() => document.getElementById(cardDomId(card.id))?.focus({ preventScroll: true }));
  }

  /* ---------- Pointer drag ---------- */

  function hitTest(x: number, y: number): { over: string | null; locked: boolean } {
    const target = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop]");
    if (!target) return { over: null, locked: false };
    return { over: target.dataset.drop ?? null, locked: target.dataset.dropLocked !== undefined };
  }

  function placeGhost() {
    const p = press.current;
    if (!p || !ghost.current) return;
    ghost.current.style.transform = `translate3d(${pointer.current.x - p.dx}px, ${pointer.current.y - p.dy}px, 0)`;
  }

  function updateOver() {
    const p = press.current;
    if (!p?.active) return;
    const { over, locked } = hitTest(pointer.current.x, pointer.current.y);
    setDrag((previous) => (previous && previous.over === over && previous.locked === locked ? previous : { id: p.id, over, locked, width: p.width }));
  }

  /* Near the top or bottom edge the page scrolls, so a card can travel from the tray to Fall 2027. */
  function autoScroll() {
    scrollFrame.current = null;
    const p = press.current;
    if (!p?.active) return;
    const { y } = pointer.current;
    const speed = y < EDGE ? -(EDGE - y) / 3 : y > window.innerHeight - EDGE ? (y - (window.innerHeight - EDGE)) / 3 : 0;
    if (speed) {
      window.scrollBy(0, speed);
      updateOver();
    }
    scrollFrame.current = requestAnimationFrame(autoScroll);
  }

  function endDrag(commit: boolean) {
    const p = press.current;
    press.current = null;
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = null;
    if (p?.element.hasPointerCapture(p.pointerId)) p.element.releasePointerCapture(p.pointerId);
    if (p?.active && commit) {
      const { over, locked } = hitTest(pointer.current.x, pointer.current.y);
      if (over && !locked) moveCard(p.id, over === "new" ? board.nextTerm : over);
      else if (locked) setAnnouncement("Terms from your record can’t change.");
    }
    setDrag(null);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLElement>, card: Card) {
    if (event.button !== 0 || press.current) return;
    const target = event.target as HTMLElement;
    if (target.closest("select, button, a, label, input")) return;
    /* Touch drags from the grip only, so a finger elsewhere on a card still scrolls the page. */
    if (event.pointerType !== "mouse" && !target.closest("[data-grip]")) return;
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    press.current = {
      id: card.id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
      width: rect.width,
      element,
      active: false,
    };
    pointer.current = { x: event.clientX, y: event.clientY };
    element.setPointerCapture(event.pointerId);
    if (event.pointerType !== "mouse") event.preventDefault();
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const p = press.current;
    if (!p || event.pointerId !== p.pointerId) return;
    pointer.current = { x: event.clientX, y: event.clientY };
    if (!p.active) {
      if (Math.hypot(event.clientX - p.x, event.clientY - p.y) < DRAG_THRESHOLD) return;
      p.active = true;
      setDrag({ id: p.id, over: null, locked: false, width: p.width });
      scrollFrame.current = requestAnimationFrame(autoScroll);
    }
    placeGhost();
    updateOver();
  }

  /* The ghost mounts with the drag; put it under the pointer before it paints. */
  useLayoutEffect(() => {
    if (drag) placeGhost();
  }, [drag]);

  useEffect(() => {
    if (!drag) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") endDrag(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- endDrag reads refs only
  }, [drag !== null]);

  /* A requirement row in the panel points at its cards: ring them and bring the first into view. */
  function showRequirement(requirement: string) {
    const targets = board.cards.filter((card) => card.slot.requirement === requirement);
    if (!targets.length) return;
    const first = targets.find((card) => termOf(card) === TRAY) ?? targets[0];
    setHighlight(requirement);
    const element = document.getElementById(cardDomId(first.id));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  }

  useEffect(() => {
    if (!highlight) return;
    const timer = window.setTimeout(() => setHighlight(null), 2400);
    return () => window.clearTimeout(timer);
  }, [highlight]);

  function focusCard(id: string) {
    const card = cardById.get(id);
    if (card) setHighlight(card.slot.requirement);
    const element = document.getElementById(cardDomId(id));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    element?.focus({ preventScroll: true });
  }

  /* ---------- Layout ---------- */

  type Column =
    | { kind: "history"; term: HistoryTerm }
    | { kind: "open"; term: string };

  const columns: Column[] = [
    ...model.history.map((term) => ({ kind: "history" as const, term })),
    ...board.openTerms.map((term) => ({ kind: "open" as const, term })),
  ];
  const nameOf = (column: Column) => (column.kind === "history" ? column.term.name : column.term);
  /*
   * Years start in the student's first season: Fall to Summer as the academic year runs,
   * or, for a new student who starts in spring, Spring to Fall, so Year 1 is their first
   * two terms rather than a lone spring.
   */
  const firstTerm = columns[0] ? nameOf(columns[0]) : "Fall 2024";
  const springStart = seasonOf(firstTerm) === "Spring";
  const yearOf = (term: string) => (springStart ? Number(term.split(" ")[1]) : academicYear(term));
  const firstYear = yearOf(firstTerm);
  const years = new Map<number, Column[]>();
  for (const column of columns) {
    const year = yearOf(nameOf(column));
    years.set(year, [...(years.get(year) ?? []), column]);
  }
  /* Every year shares the same columns, Fall | Spring (| Summer), so a term lines up with the years above and below. */
  const hasSummer = columns.some((column) => isSummer(nameOf(column)));
  const seasons = (springStart ? ["Spring", "Summer", "Fall"] : ["Fall", "Spring", "Summer"])
    .filter((season) => hasSummer || season !== "Summer");
  const columnStyle = (term: string) => ({ "--fy-col": seasons.indexOf(seasonOf(term)) + 1 }) as CSSProperties;

  /* Courses already on the board count once, so an open slot's picker leaves them out. */
  const chosenElsewhere = (card: Card) =>
    new Set(board.cards.filter((other) => other.id !== card.id && other.code).map((other) => other.code!));
  const trayCards = board.cards.filter((card) => termOf(card) === TRAY);
  const trayRequired = trayCards.filter((card) => !board.optional.has(card.id));
  const trayOptional = trayCards.filter((card) => board.optional.has(card.id));
  const draggedCard = drag ? cardById.get(drag.id) : undefined;
  /* Why an optional card is optional: what already covers its requirement ("MKTG 3511, MKTG 3596 and MKTG 3508"). */
  const coveredNotes = [...new Set(trayOptional.map((card) => card.slot.requirement))].flatMap((requirement) => {
    const row = progress.requirements.find((item) => item.id === requirement);
    const codes = row?.satisfiedBy
      .filter((item) => item.state === "planned" && !item.code.startsWith(PLACEHOLDER))
      .map((item) => item.code) ?? [];
    return row && codes.length ? [`${row.label} are covered by ${listOf(codes)}.`] : [];
  });

  function renderCard(card: Card) {
    const issue = board.issues.get(card.id);
    const name = card.code ?? card.fills;
    /* Only an open slot picks its course here; a card with a course keeps it (it moves by dragging). */
    const taken = card.code ? null : chosenElsewhere(card);
    const picks = taken ? card.options.filter((option) => !taken.has(option)) : [];
    return (
      <article
        key={card.id}
        id={cardDomId(card.id)}
        tabIndex={-1}
        className="fy-card"
        data-kind={card.kind}
        data-placeholder={card.code ? undefined : ""}
        data-dragging={drag?.id === card.id || undefined}
        data-highlight={highlight === card.slot.requirement || undefined}
        aria-label={`${name}, ${card.title}, ${card.credits} ${card.credits === 1 ? "credit" : "credits"}${card.code ? `, counts toward ${card.fills}` : ""}`}
        onPointerDown={(event) => onPointerDown(event, card)}
        onPointerMove={onPointerMove}
        onPointerUp={() => endDrag(true)}
        onPointerCancel={() => endDrag(false)}
        onLostPointerCapture={() => press.current?.active && endDrag(false)}
      >
        <div className="fy-card-top">
          <CardEyebrow card={card} />
          <span className="fy-grip" data-grip="" aria-hidden="true"><GripIcon /></span>
        </div>
        <p className="fy-card-title">{card.title}</p>
        <p className="fy-card-fills">{card.fills}</p>
        {issue && <IssueLine issue={issue} />}
        {picks.length > 0 && (
          <label className="fy-pick">
            <span className="fy-sr">Choose a course for {card.fills}</span>
            <select value="" onChange={(event) => event.target.value && chooseCourse(card, event.target.value)}>
              <option value="" disabled>{picks.length === 1 ? "Pick the 1 course that fits" : `Pick from ${picks.length} courses`}</option>
              {picks.map((code) => (
                <option key={code} value={code}>{code} · {courseTitle(code) ?? "Title not in the bulletin data"}</option>
              ))}
            </select>
            <ChevronIcon />
          </label>
        )}
      </article>
    );
  }

  function toggleEditing(term: string) {
    setEditing((previous) => {
      const next = new Set(previous);
      if (next.has(term)) next.delete(term);
      else next.add(term);
      return next;
    });
  }

  /* A planned card as a record row: the same markup, so terms ahead read like the ones behind. */
  function renderPlannedRow(card: Card) {
    const issue = board.issues.get(card.id);
    const title = card.code ? card.title : card.fills;
    return (
      <li key={card.id} id={cardDomId(card.id)} tabIndex={-1} className="fy-row" data-kind={card.kind}
        data-placeholder={card.code ? undefined : ""}
        data-highlight={highlight === card.slot.requirement || undefined}
        title={issue ? issue.detail : card.code ? `Counts toward ${card.fills}` : undefined}>
        <span className="fy-row-code">{card.code ?? "Open slot"}</span>
        <span className="fy-row-title">
          {issue && (
            <span className="fy-row-issue" data-state={issue.state}>
              {issue.state === "missing" ? <AlertIcon /> : <InfoIcon />}
              <span className="fy-sr">{issue.text}. </span>
            </span>
          )}
          {title}
        </span>
        <span className="fy-row-credits">{card.credits}</span>
      </li>
    );
  }

  function renderRecordRow(item: RecordItem) {
    return (
      <li key={item.code} className="fy-row" data-kind={item.kind} title={item.fills ? `Counts toward ${item.fills}` : undefined}>
        <span className="fy-row-code">{item.code}</span>
        <span className="fy-row-title">{item.title}</span>
        <span className="fy-row-credits">{item.credits}</span>
      </li>
    );
  }

  function creditTone(credits: number, term: string) {
    if (credits > CREDIT_MAX) return { tone: "warning", note: `over ${CREDIT_MAX}` };
    if (!isSummer(term) && credits > 0 && credits < CREDIT_MIN) return { tone: "warning", note: `under ${CREDIT_MIN}` };
    return null;
  }

  function termHeader(name: string, credits: number, chip: ReactNode, action?: ReactNode) {
    const tone = creditTone(credits, name);
    return (
      <header className="fy-term-head">
        <h3>{name}</h3>
        {chip}
        {action}
        <span className="fy-term-credits" data-tone={tone?.tone}>
          {credits} cr{tone && <span className="fy-term-credits-note"> · {tone.note}</span>}
        </span>
      </header>
    );
  }

  function renderColumn(column: Column) {
    if (column.kind === "history") {
      const term = column.term;
      const items = term.fromPlan ? current : term.courses;
      const state = term.fromPlan ? "current" : term.status;
      const credits = items.reduce((sum, item) => sum + item.credits, 0);
      return (
        <section key={term.name} className="fy-term" data-state={state} data-season={seasonOf(term.name)}
          style={columnStyle(term.name)} data-drop={term.name} data-drop-locked=""
          aria-label={`${term.name}, ${STATUS_LABEL[state]}`}>
          {termHeader(term.name, credits, <span className="fy-chip" data-state={state}>{STATUS_LABEL[state]}</span>)}
          {items.length ? <ul className="fy-rows">{items.map(renderRecordRow)}</ul> : <p className="fy-empty">No courses</p>}
          {term.fromPlan && (
            <Link href="/plan" className="fy-link fy-term-link">Edit in Your plan <span aria-hidden="true">→</span></Link>
          )}
          {drag && drag.over === term.name && drag.locked && (
            <p className="fy-locked-note" role="status">Locked: this term is on your record</p>
          )}
        </section>
      );
    }
    const term = column.term;
    const cards = board.cards.filter((card) => termOf(card) === term);
    const credits = cards.reduce((sum, card) => sum + card.credits, 0);
    const pastGoal = termOrder(term) > termOrder(board.goal);
    const isEditing = editing.has(term);
    const bodyId = `fy-term-body-${term.replace(/\W+/g, "-")}`;
    return (
      <section key={term} className="fy-term" data-state="open" data-season={seasonOf(term)} style={columnStyle(term)} data-drop={term}
        data-over={drag?.over === term || undefined} aria-label={`${term}, planned`}>
        {termHeader(term, credits, term === board.goal
          ? <span className="fy-chip" data-state="goal">Graduation goal</span>
          : pastGoal && cards.length
            ? <span className="fy-chip" data-state="late">Past your goal</span>
            : <span className="fy-chip" data-state="open">Planned</span>,
        <button type="button" className="btn empty fy-term-edit" aria-expanded={isEditing} aria-controls={bodyId}
          onClick={() => toggleEditing(term)}>
          {isEditing ? "Done" : "Edit"}<span className="fy-sr"> {term}</span>
        </button>)}
        {!cards.length
          ? <p id={bodyId} className="fy-empty fy-drop-hint">Drag a course here</p>
          : isEditing
            ? <div id={bodyId} className="fy-cards">{cards.map(renderCard)}</div>
            : <ul id={bodyId} className="fy-rows">{cards.map(renderPlannedRow)}</ul>}
      </section>
    );
  }

  const catalog = record.catalogYear ? `Catalog ${record.catalogYear}` : `${bulletinYear} bulletin`;

  return (
    <div className="fy" data-dragging={drag ? "" : undefined}>
      <div className="workspace-heading fy-heading">
        <div>
          <p className="eyebrow">{programHeading(program)} · {catalog}</p>
          <h1>Four-year plan</h1>
          <p className="intro">
            {profile.isNew
              ? "No courses yet. We’ve laid out all four years from the degree requirements. Drag a course to move it, or let us place them again."
              : "Your audit is filled in. Drag the remaining courses into terms, or let us place them."}
          </p>
        </div>
        <div className="fy-actions">
          <Link href="/onboarding" className="fy-link">Edit setup</Link>
          <button type="button" className="btn empty fy-replace" disabled={!hasMoves}
            onClick={() => { clearMoves(); setAnnouncement("Remaining courses placed again."); }}>
            Re-place remaining courses
          </button>
        </div>
      </div>

      {!prefs.completedAt && (
        <p className="fy-banner">
          <InfoIcon />
          <span>
            Placed with the usual setup: {prefs.creditsPerTerm} credits a term, {prefs.summers ? "summers on" : "no summers"},
            finishing {prefs.graduationTerm}.
          </span>
          <Link href="/onboarding" className="fy-link">Set up your plan <span aria-hidden="true">→</span></Link>
        </p>
      )}

      <div className="fy-layout">
        <aside className="fy-rail" aria-label="Graduation progress">
          <ProgressPanel
            program={program}
            minor={record.minor}
            progress={progress}
            goal={board.goal}
            board={board}
            onShowRequirement={showRequirement}
            onShowCard={focusCard}
          />
        </aside>

        <div className="fy-board">
          <div className="fy-years">
            {[...years.entries()].map(([year, yearColumns]) => {
              const allDone = yearColumns.every((column) => column.kind === "history" && column.term.status === "completed");
              return (
                <section key={year} className="fy-year" data-done={allDone || undefined}
                  aria-labelledby={`fy-year-${year}`}>
                  <h2 id={`fy-year-${year}`} className="fy-year-head">
                    Year {year - firstYear + 1}
                    <span className="fy-year-span"> · {springStart ? year : `${year}–${String(year + 1).slice(-2)}`}</span>
                  </h2>
                  <div className="fy-terms" style={{ "--fy-cols": hasSummer ? 3 : 2 } as CSSProperties}>
                    {yearColumns.map(renderColumn)}
                  </div>
                </section>
              );
            })}
            <div className="fy-new-term" data-drop="new" data-over={drag?.over === "new" || undefined}>
              <span>Drag a course here to add {board.nextTerm}</span>
            </div>
          </div>

          <section className="fy-tray" data-drop={TRAY} data-over={drag?.over === TRAY || undefined}
            aria-labelledby="fy-tray-head">
            <header className="fy-tray-head">
              <h2 id="fy-tray-head">Still to place</h2>
              <span className="fy-term-credits">
                {trayRequired.length
                  ? `${trayRequired.length} needed · ${trayRequired.reduce((sum, card) => sum + card.credits, 0)} cr`
                  : "Nothing required left"}
              </span>
            </header>
            {trayRequired.length > 0
              ? (
                <>
                  <p className="fy-tray-note" data-tone="warning">You need these to graduate. Drag each into a term.</p>
                  <div className="fy-cards">{trayRequired.map(renderCard)}</div>
                </>
              )
              : <p className="fy-tray-note">Every required course has a term. Drag one here to take it out of the plan.</p>}
            {trayOptional.length > 0 && (
              <div className="fy-tray-optional">
                <h3>Optional</h3>
                <p className="fy-tray-note">
                  Your plan meets these requirements without them. {coveredNotes.join(" ")} Add one if you want it.
                </p>
                <div className="fy-cards">{trayOptional.map(renderCard)}</div>
              </div>
            )}
          </section>
        </div>
      </div>

      {drag && draggedCard && (
        <div ref={ghost} className="fy-ghost" data-kind={draggedCard.kind} data-locked={drag.locked || undefined}
          style={{ width: drag.width }} aria-hidden="true">
          <div className="fy-card-top">
            <CardEyebrow card={draggedCard} />
          </div>
          <p className="fy-card-title">{draggedCard.title}</p>
        </div>
      )}

      <p className="fy-sr" aria-live="polite">{announcement}</p>
    </div>
  );
}

/* "Fall" of "Fall 2027": which aligned column a term sits in. */
function seasonOf(term: string) {
  return term.split(" ")[0];
}

function listOf(items: string[]) {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

export function cardDomId(id: string) {
  return `fy-card-${id.replace(/[^a-z0-9]+/gi, "-")}`;
}

/* The plan page's eyebrow: "PHYS 2922 · 4 credits", in the kind's ink. */
function CardEyebrow({ card }: { card: Card }) {
  return (
    <span className="fy-card-code">
      {card.code ?? "Open slot"} · {card.credits} {card.credits === 1 ? "credit" : "credits"}
    </span>
  );
}

function IssueLine({ issue }: { issue: Issue }) {
  return (
    <p className="fy-card-issue" data-state={issue.state} title={issue.detail}>
      {issue.state === "missing" ? <AlertIcon /> : <InfoIcon />}
      <span>{issue.text}</span>
    </p>
  );
}

