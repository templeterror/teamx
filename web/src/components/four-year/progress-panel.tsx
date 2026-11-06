"use client";

import { useState, type CSSProperties } from "react";
import { programs, type ProgramCode } from "@/data";
import type { GraduationProgress, RequirementProgress } from "@/components/progress/progress";
import { CREDIT_MAX, PLACEHOLDER, TRAY, type Board, type Card } from "./board";
import { AlertIcon, CheckIcon, ChevronIcon, InfoIcon } from "./icons";

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

const STATUS_TEXT: Record<RequirementProgress["status"], string> = {
  met: "Met",
  "in-progress": "In progress",
  planned: "Planned",
  missing: "Missing",
};

const STATE_TEXT = { completed: "Completed", "in-progress": "In progress", registered: "Registered", planned: "Planned" } as const;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

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
  let tone: "success" | "warning" = progress.onTrack ? "success" : "warning";
  let headline: string;
  let detail: string;
  if (progress.onTrack && progress.graduationTerm) {
    headline = `On track to graduate ${progress.graduationTerm}`;
    const apart = termsApart(goal, progress.graduationTerm);
    if (apart === 0) detail = `Meets your ${goal} goal.`;
    else if (apart < 0) detail = `${plural(-apart, "term")} ahead of your ${goal} goal.`;
    else {
      tone = "warning";
      detail = `${plural(apart, "term")} past your ${goal} goal. Take more credits a term or add summers in setup.`;
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
    detail = `${parts.join(" and ")} unplaced${names.length ? `: ${names.join(", ")}${more}` : ""}.`
      + (inTray ? " Drag what’s left from Still to place into a term." : "");
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

  const groups = GROUP_ORDER.map((group) => ({ group, rows: requirements.filter((row) => groupOf(row) === group) }))
    .filter(({ rows }) => rows.length);

  const trayFor = (row: RequirementProgress) =>
    board.cards.filter((card) => card.slot.requirement === row.id && board.placement[card.id] === TRAY && !board.optional.has(card.id));
  const cardLabel = (code: string) => {
    if (!code.startsWith(PLACEHOLDER)) return code;
    return board.cards.find((card) => card.id === code.slice(PLACEHOLDER.length))?.fills ?? "Open slot";
  };

  function renderRow(row: RequirementProgress) {
    const isOpen = open.has(row.id);
    const size = Math.max(row.required.credits, row.done + row.inProgress + row.planned + row.missingCredits, 1);
    const tray = trayFor(row);
    const status = row.status === "missing" ? `Missing ${plural(row.missingCredits, "credit")}` : STATUS_TEXT[row.status];
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
          <span className="fy-req-status">
            {row.status === "met" && <CheckIcon />}
            {status}
          </span>
          <ChevronIcon />
          <span className="fy-req-bar" aria-hidden="true"
            style={{
              "--done": `${(row.done / size) * 100}%`,
              "--progress": `${(row.inProgress / size) * 100}%`,
              "--planned": `${(row.planned / size) * 100}%`,
            } as CSSProperties}>
            <span data-seg="done" />
            <span data-seg="progress" />
            <span data-seg="planned" />
          </span>
        </button>
        {isOpen && (
          <div className="fy-req-body" id={bodyId}>
            {row.missing.map((item) => {
              const what = describeMissing(item);
              return (
                <p key={item.label} className="fy-req-missing">
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
                  <li key={`${item.code}-${item.term}`} data-state={item.state}>
                    <span className="fy-req-code">{cardLabel(item.code)}</span>
                    <span>{item.term}</span>
                    <span>{STATE_TEXT[item.state]}</span>
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
      <p className="fy-progress-label">Graduation progress</p>
      <div className="fy-headline" data-tone={tone} aria-live="polite">
        {tone === "success" ? <CheckIcon /> : <AlertIcon />}
        <div>
          <h2>{headline}</h2>
          <p>{detail}</p>
        </div>
      </div>

      <div className="fy-meter-block">
        <div className="fy-meter-caption">
          <span>Credits</span>
          <span className="fy-num">
            {Math.min(total.done + total.inProgress + total.planned, total.required)} of {total.required}
          </span>
        </div>
        <div className="fy-meter" role="img"
          aria-label={`${total.done} credits done, ${total.inProgress} in progress or registered, ${total.planned} planned, ${total.missing} missing, of ${total.required}`}>
          <span data-seg="done" style={{ width: share(doneW) }} />
          <span data-seg="progress" style={{ width: share(progressW) }} />
          <span data-seg="planned" style={{ width: share(plannedW) }} />
        </div>
        <dl className="fy-legend">
          <div><dt><i data-seg="done" />Done</dt><dd>{total.done}</dd></div>
          <div><dt><i data-seg="progress" />In progress</dt><dd>{total.inProgress}</dd></div>
          <div><dt><i data-seg="planned" />Planned</dt><dd>{total.planned}</dd></div>
          <div data-tone={total.missing ? "warning" : undefined}><dt><i data-seg="missing" />Missing</dt><dd>{total.missing}</dd></div>
        </dl>
        {beyond > 0 && <p className="fy-meter-note">{beyond} credits beyond the {total.required} the degree needs.</p>}
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
          const missing = rows.filter((row) => row.status === "missing").length;
          const expanded = shownGroups.has(group);
          const pending = rows.filter((row) => row.status === "missing" || row.status === "planned");
          const visible = expanded ? rows : pending;
          const hidden = rows.length - pending.length;
          return (
            <section key={group} className="fy-group" aria-labelledby={`fy-group-${group}`}>
              <h3 id={`fy-group-${group}`} className="fy-group-head">
                <span>{groupTitle(group, rows, program, minor)}</span>
                <span className="fy-group-count" data-tone={missing ? "warning" : undefined}>
                  {missing ? `${missing} missing` : pending.length ? `${pending.length} planned` : "Done or underway"}
                </span>
              </h3>
              <ul className="fy-reqs">
                {visible.map(renderRow)}
              </ul>
              {hidden > 0 && (
                <button type="button" className="fy-group-more" aria-expanded={expanded}
                  onClick={() => toggleIn(setShownGroups, group)}>
                  {expanded
                    ? "Show only what’s left"
                    : `${hidden} ${hidden === 1 ? "requirement" : "requirements"} met or in progress`}
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
