"use client";

import { useState } from "react";
import { programs, type ProgramCode } from "@/data";
import type { GraduationProgress, RequirementProgress } from "@/components/progress/progress";
import { CREDIT_MAX, PLACEHOLDER, TRAY, type Board, type Card } from "./board";
import { AlertIcon, ChevronIcon, InfoIcon } from "./icons";

type Props = {
  program: ProgramCode;
  minor: string | null;
  progress: GraduationProgress;
  /* The student's graduation goal from setup: "Spring 2028". */
  goal: string;
  board: Board;
  onShowRequirement: (requirement: string) => void;
  onShowCard: (cardId: string) => void;
};

type GroupId = "gened" | "foundation" | "major" | "electives" | "minor" | "university";
const GROUP_ORDER: GroupId[] = ["gened", "foundation", "major", "electives", "minor", "university"];

/* Business electives are a Fox foundation requirement; progress files them with electives. */
function groupOf(row: RequirementProgress): GroupId {
  if (row.id === "fox.upper-foundation.business-electives") return "foundation";
  return row.group;
}

/* "MIS major" for a long program name, "Computer Science major" for a short one. */
function majorTitle(program: ProgramCode) {
  const words = programs[program].degree.program.name.split(" ").filter((word) => /^[A-Z]/.test(word));
  return words.length >= 3 ? `${words.map((word) => word[0]).join("")} major` : `${words.join(" ")} major`;
}

function groupTitle(group: GroupId, rows: RequirementProgress[], program: ProgramCode, minor: string | null) {
  switch (group) {
    case "gened": return "General Education";
    case "foundation": return rows.some((row) => row.id.startsWith("fox.")) ? "Fox foundation" : "Foundation";
    case "major": return majorTitle(program);
    case "electives": return "Free electives";
    case "minor": return minor ? `${minor} minor` : "Minor";
    case "university": return "University";
  }
}

const STATE_TEXT = { completed: "Completed", "in-progress": "In progress", registered: "Registered", planned: "Planned" } as const;
/* A course's state as a step on the progress ramp, the same swatch the legend uses. */
const STATE_SEG = { completed: "done", "in-progress": "progress", registered: "progress", planned: "planned" } as const;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/* Spring, Summer, Fall in calendar order. */
const termIndex = (term: string) => {
  const [season, year] = term.split(" ");
  return Number(year) * 3 + (season === "Fall" ? 2 : season === "Summer" ? 1 : 0);
};

/* The term a requirement finishes: the latest term of anything counting toward it. */
function finishTerm(row: RequirementProgress): string | null {
  return row.satisfiedBy.reduce<string | null>(
    (latest, item) => (!latest || termIndex(item.term) > termIndex(latest) ? item.term : latest), null);
}

/* Regular terms between two terms; a summer counts with the spring before it. */
function termsApart(from: string, to: string) {
  const index = (term: string) => {
    const [season, year] = term.split(" ");
    return Number(year) * 2 + (season === "Fall" ? 1 : 0);
  };
  return index(to) - index(from);
}

/* "FIN 3101 or FIN 3901"; "2000–3999 courses in ACCT, AS, BA, ECON and 22 more subjects". */
function describeMissing(item: RequirementProgress["missing"][number]): string | null {
  if (item.from?.length) {
    if (item.from.length <= 3) return item.from.join(" or ");
    return `one of ${item.from.length} listed courses`;
  }
  if (item.pool?.length) {
    const subjects = [...new Set(item.pool.map((pattern) => pattern.split(" ")[0]))];
    const levels = [...new Set(item.pool.map((pattern) => pattern.split(" ")[1]?.[0]).filter(Boolean))].sort();
    const range = levels.length ? `${levels[0]}000–${levels.at(-1)}999 ` : "";
    const named = subjects.slice(0, 4).join(", ");
    const more = subjects.length > 4 ? ` and ${subjects.length - 4} more subjects` : "";
    return `${range}courses in ${named}${more}`;
  }
  return null;
}

function toggleIn(set: (update: (previous: Set<string>) => Set<string>) => void, id: string) {
  set((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

export function ProgressPanel({ program, minor, progress, goal, board, onShowRequirement, onShowCard }: Props) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [shownGroups, setShownGroups] = useState<Set<string>>(() => new Set());
  const { totalCredits: total, requirements } = progress;
  const missingRows = requirements.filter((row) => row.status === "missing");

  const toggle = (id: string) => toggleIn(setOpen, id);

  /* ---------- Headline ---------- */
  /* The headline states the fact in ink; the problem, when there is one, is the amber sentence under it. */
  let headline: string;
  let problem: string | null = null;
  let detail: string | null = null;
  if (progress.onTrack && progress.graduationTerm) {
    const apart = termsApart(goal, progress.graduationTerm);
    if (apart > 0) {
      headline = `Graduating ${progress.graduationTerm}`;
      problem = `${plural(apart, "term")} after your ${goal} goal.`;
      detail = "Take more credits a term or add summers in setup.";
    } else {
      headline = `On track to graduate ${progress.graduationTerm}`;
      detail = apart === 0 ? `Meets your ${goal} goal.` : `${plural(-apart, "term")} ahead of your ${goal} goal.`;
    }
  } else {
    headline = "Not on track yet";
    const parts = [
      ...(total.missing ? [plural(total.missing, "credit")] : []),
      ...(missingRows.length ? [plural(missingRows.length, "requirement")] : []),
    ];
    const names = missingRows.slice(0, 3).map((row) => `${row.label} (${row.missingCredits} cr)`);
    const more = missingRows.length > 3 ? ` and ${missingRows.length - 3} more` : "";
    const inTray = board.cards.some((card) => board.placement[card.id] === TRAY && !board.optional.has(card.id));
    problem = `${parts.join(" and ")} unplaced${names.length ? `: ${names.join(", ")}${more}` : ""}.`;
    detail = inTray ? "Drag what’s left from Still to place into a term." : null;
  }

  /* ---------- Plan checks ---------- */
  const issues = board.cards.flatMap((card) => {
    const issue = board.issues.get(card.id);
    return issue ? [{ card, issue }] : [];
  });
  const outOfOrder = issues.filter(({ issue }) => issue.state === "missing");
  const toCheck = issues.filter(({ issue }) => issue.state === "check");
  const overloaded = board.openTerms.flatMap((term) => {
    const credits = board.cards.filter((card) => board.placement[card.id] === term).reduce((sum, card) => sum + card.credits, 0);
    return credits > CREDIT_MAX ? [{ term, credits }] : [];
  });

  /* Codes as links, each comma kept with the code before it so a list never wraps onto a lone separator. */
  const codeLinks = (items: { card: Card }[]) => items.map(({ card }, index) => (
    <span key={card.id}>
      <span className="fy-checks-item">
        <button type="button" className="fy-inline-link" onClick={() => onShowCard(card.id)}>{card.code}</button>
        {index < items.length - 1 && ","}
      </span>
      {index < items.length - 1 && " "}
    </span>
  ));

  /* ---------- Meter ---------- */
  const required = Math.max(total.required, 1);
  const share = (credits: number) => `${Math.min(credits / required, 1) * 100}%`;
  const doneW = Math.min(total.done, required);
  const progressW = Math.min(total.inProgress, required - doneW);
  const plannedW = Math.min(total.planned, required - doneW - progressW);
  const beyond = total.done + total.inProgress + total.planned - total.required;
  const legend = [
    { seg: "done", count: total.done, label: "done" },
    { seg: "progress", count: total.inProgress, label: "in progress" },
    { seg: "planned", count: total.planned, label: "planned" },
    ...(total.missing ? [{ seg: "missing", count: total.missing, label: "missing" }] : []),
  ];

  const groups = GROUP_ORDER.map((group) => ({ group, rows: requirements.filter((row) => groupOf(row) === group) }))
    .filter(({ rows }) => rows.length);

  const trayFor = (row: RequirementProgress) =>
    board.cards.filter((card) => card.slot.requirement === row.id && board.placement[card.id] === TRAY && !board.optional.has(card.id));
  /* An open card is "Open slot", as on the board; the row already says what it fills. */
  const cardLabel = (code: string) => (code.startsWith(PLACEHOLDER) ? "Open slot" : code);

  /* Right of the label: what's missing, or the term the requirement finishes. */
  function rowStatus(row: RequirementProgress) {
    if (row.status === "missing") return <>{row.missingCredits} cr missing</>;
    if (row.status === "met") return <>Met</>;
    if (row.status === "in-progress") return <>In progress</>;
    const term = finishTerm(row);
    return term ? <><span className="fy-sr">Planned through </span>{term}</> : <>Planned</>;
  }

  function renderRow(row: RequirementProgress) {
    const isOpen = open.has(row.id);
    const tray = trayFor(row);
    const bodyId = `fy-req-${row.id.replace(/[^a-z0-9]+/gi, "-")}`;
    return (
      <li key={row.id} className="fy-req" data-status={row.status} data-open={isOpen || undefined}>
        <button
          type="button"
          className="fy-req-head"
          aria-expanded={isOpen}
          aria-controls={bodyId}
          onClick={() => {
            toggle(row.id);
            if (!isOpen && row.status === "missing" && tray.length) onShowRequirement(row.id);
          }}
        >
          <span className="fy-req-label">{row.label}</span>
          <span className="fy-req-status">{rowStatus(row)}</span>
          <ChevronIcon />
        </button>
        {isOpen && (
          <div className="fy-req-body" id={bodyId}>
            {row.missing.map((item, index) => {
              const what = describeMissing(item);
              return (
                <p key={`${item.label}-${index}`} className="fy-req-missing">
                  <strong>{item.label}</strong>: missing {plural(item.credits, "credit")}{what ? ` from ${what}` : ""}.
                </p>
              );
            })}
            {row.status === "missing" && (
              tray.length
                ? (
                  <button type="button" className="fy-inline-link" onClick={() => onShowRequirement(row.id)}>
                    Show {tray.length === 1 ? "its card" : `its ${tray.length} cards`} in Still to place
                  </button>
                )
                : <p className="fy-req-note">No card on the board fills this yet. Ask your advisor which course to add.</p>
            )}
            {row.satisfiedBy.length > 0 && (
              <ul className="fy-req-courses">
                {row.satisfiedBy.map((item) => (
                  <li key={`${item.code}-${item.term}`}>
                    <i data-seg={STATE_SEG[item.state]} aria-hidden="true" />
                    <span className="fy-req-code">{cardLabel(item.code)}</span>
                    <span className="fy-sr">, {STATE_TEXT[item.state]}, </span>
                    <span className="fy-req-term">{item.term}</span>
                  </li>
                ))}
              </ul>
            )}
            {row.note && <p className="fy-req-note">{row.note}</p>}
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="fy-progress">
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
        <div className="fy-meter-caption">
          <span>Credits</span>
          <span className="fy-num">
            {total.required} needed{beyond > 0 && <span className="fy-meter-extra"> · {beyond} extra</span>}
          </span>
        </div>
        <div className="fy-meter" role="img"
          aria-label={`${total.done} credits done, ${total.inProgress} in progress or registered, ${total.planned} planned, ${total.missing} missing, of ${total.required}`}>
          <span data-seg="done" style={{ width: share(doneW) }} />
          <span data-seg="progress" style={{ width: share(progressW) }} />
          <span data-seg="planned" style={{ width: share(plannedW) }} />
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

      {(outOfOrder.length > 0 || overloaded.length > 0 || toCheck.length > 0) && (
        <div className="fy-checks">
          {outOfOrder.length > 0 && (
            <p data-tone="warning">
              <AlertIcon />
              <span>
                {outOfOrder.length === 1 ? "1 course is" : `${outOfOrder.length} courses are`} out of order:{" "}
                {codeLinks(outOfOrder)}
              </span>
            </p>
          )}
          {overloaded.map(({ term, credits }) => (
            <p key={term} data-tone="warning">
              <AlertIcon />
              <span>{term} is {credits} credits — over {CREDIT_MAX} needs approval</span>
            </p>
          ))}
          {toCheck.length > 0 && (
            <p>
              <InfoIcon />
              <span>
                Check with your advisor:{" "}
                {codeLinks(toCheck)}
              </span>
            </p>
          )}
        </div>
      )}

      <div className="fy-groups">
        {groups.map(({ group, rows }) => {
          const title = groupTitle(group, rows, program, minor);
          /* "Free electives" holding one "Free electives" row: the row is its own heading. */
          const solo = rows.length === 1 && rows[0].label.toLowerCase() === title.toLowerCase();
          const expanded = solo || shownGroups.has(group);
          const pending = rows.filter((row) => row.status === "missing" || row.status === "planned");
          const visible = expanded ? rows : pending;
          const hidden = rows.length - pending.length;
          return (
            <section key={group} className="fy-group"
              {...(solo ? { "aria-label": title } : { "aria-labelledby": `fy-group-${group}` })}>
              {!solo && <h3 id={`fy-group-${group}`} className="fy-group-head">{title}</h3>}
              <ul className="fy-reqs">
                {visible.map(renderRow)}
              </ul>
              {!solo && hidden > 0 && (
                <button type="button" className="fy-group-more" aria-expanded={expanded}
                  onClick={() => toggleIn(setShownGroups, group)}>
                  {expanded ? "Show only what’s left" : `${hidden} more met or in progress`}
                  <ChevronIcon />
                </button>
              )}
            </section>
          );
        })}
      </div>

      <p className="fy-advisor">Confirm the plan with your advisor before you register.</p>
    </div>
  );
}
