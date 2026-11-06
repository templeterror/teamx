/*
 * The four-year board, pure (no React): the student's record as locked terms, the audit's
 * open slots (progress.ts openSlots) as cards, and autoPlace, which lays those cards into
 * the terms ahead. The student's own edits (moves and course choices, see edits.ts) sit on
 * top of autoPlace, so a change of preferences re-flows every card they have not moved.
 */
import { courses, type ProgramCode, type StudentRecord } from "@/data";
import {
  graduationProgress,
  openSlots,
  termOrder,
  type OpenSlot,
  type PlacedCourse,
  type RequirementProgress,
  type SlotKind,
} from "@/components/progress/progress";
import { opensOnRegistration } from "@/components/plan/data";
import { profileFor, type ProfileId } from "@/components/student/student";

export type Kind = SlotKind;

/* A card's place when it is on no term: the "Still to place" tray. */
export const TRAY = "tray";

/* Hard ceiling of a regular term (the plan page warns past it); summers are lighter. */
export const CREDIT_MAX = 18;
export const CREDIT_MIN = 12;
const SUMMER_TARGET = 6;
const SUMMER_MAX = 8;
/* How far past the graduation goal a move or autoPlace may reach. */
const EXTRA_TERMS = 4;

/* ---------- Catalog ---------- */

type Expr =
  | { op: "all" | "any"; of: Expr[] }
  | { kind: "course"; code: string; concurrent?: boolean }
  | { kind: "subjectRange"; subject: string; from: string; to: string; concurrent?: boolean }
  | { kind: "placement"; code: string };

type CatalogCourse = {
  title: string;
  credits: { value?: number; min?: number; max?: number; options?: number[] };
  prerequisites: { raw: string; expression?: Expr | null } | null;
  restrictions?: Record<string, string>;
  attributes?: string[];
  genEdAreas: string[];
};
const CATALOG = courses as unknown as Record<string, CatalogCourse>;

export function courseTitle(code: string): string | undefined {
  return CATALOG[code]?.title;
}

function catalogCredits(code: string): number | undefined {
  const credits = CATALOG[code]?.credits;
  if (!credits) return undefined;
  /* A lab science lists [0, 4]: 0 is the lab section on its own, 4 the course. */
  return credits.value ?? credits.min ?? (credits.options ? Math.max(...credits.options) : undefined);
}

const CODE = /[A-Z]{2,5} \d{4}/;

/* ---------- Terms ---------- */

type Season = "Spring" | "Summer" | "Fall";

function parseTerm(term: string): { season: Season; year: number } | null {
  const match = /^(Spring|Summer|Fall) (\d{4})$/.exec(term);
  return match ? { season: match[1] as Season, year: Number(match[2]) } : null;
}

export function isSummer(term: string) {
  return term.startsWith("Summer");
}

/* The term after this one; summers only when the student takes them. */
function nextTerm(term: string, summers: boolean): string {
  const parsed = parseTerm(term);
  if (!parsed) return term;
  if (parsed.season === "Fall") return `Spring ${parsed.year + 1}`;
  if (parsed.season === "Spring") return summers ? `Summer ${parsed.year}` : `Fall ${parsed.year}`;
  return `Fall ${parsed.year}`;
}

/* The academic year a term belongs to, by its fall: Spring 2025 is 2024's. */
export function academicYear(term: string): number {
  const parsed = parseTerm(term);
  if (!parsed) return 0;
  return parsed.season === "Fall" ? parsed.year : parsed.year - 1;
}

/* ---------- The model: what the record and the audit say ---------- */

export type RecordState = "completed" | "in-progress" | "registered";

export type RecordItem = {
  code: string;
  title: string;
  credits: number;
  kind: Kind;
  state: RecordState;
  /* The requirement row the course counts toward ("Lower-division foundation"). */
  fills: string | null;
};

export type HistoryTerm = {
  name: string;
  status: RecordState;
  courses: RecordItem[];
  credits: number;
  /* Rafiat's registered term is planned on /plan, so the board reads it from there. */
  fromPlan: boolean;
};

export type Model = {
  profile: ProfileId;
  program: ProgramCode;
  record: StudentRecord;
  slots: OpenSlot[];
  history: HistoryTerm[];
  lastRecordTerm: string;
  /* Credits on the record, every state: what the student will have before the terms ahead. */
  recordCredits: number;
  /* The record plus what the audit says those courses stand in for (ACCT 2903 for ACCT 2103). */
  taken: Set<string>;
  rows: Map<string, RequirementProgress>;
  kindOf: (code: string) => Kind;
  fillsOf: (code: string) => string | null;
};

/* The same kinds as the open slots (progress.ts slotKind), read from a requirement row. */
export function rowKind(row: Pick<RequirementProgress, "id" | "group">): Kind {
  if (row.id === "free-electives") return "free-elective";
  if (row.group === "gened") return "gened";
  if (row.group === "minor" || row.group === "university" || /elective/.test(row.id)) return "elective";
  return "core";
}

function buildModel(profile: ProfileId): Model {
  const { program, record } = profileFor(profile);
  const baseline = graduationProgress(program, record, []);
  const rows = new Map(baseline.requirements.map((row) => [row.id, row]));
  const rowOf = new Map<string, RequirementProgress>();
  for (const row of baseline.requirements) {
    for (const item of row.satisfiedBy) if (!rowOf.has(item.code)) rowOf.set(item.code, row);
  }
  const kindOf = (code: string): Kind => {
    const row = rowOf.get(code);
    if (row) return rowKind(row);
    if (CATALOG[code]?.genEdAreas.length) return "gened";
    return "free-elective";
  };
  const fillsOf = (code: string) => rowOf.get(code)?.label ?? null;

  const fromPlan = opensOnRegistration(program);
  const history: HistoryTerm[] = record.terms.map((term) => {
    const items = term.courses.map((course) => ({
      code: course.code,
      title: course.title,
      credits: course.credits,
      kind: kindOf(course.code),
      state: course.status ?? term.status,
      fills: fillsOf(course.code),
    }));
    return {
      name: term.term,
      status: term.status,
      courses: items,
      credits: items.reduce((sum, item) => sum + item.credits, 0),
      fromPlan: fromPlan && term.status === "registered",
    };
  });

  const taken = new Set(record.terms.flatMap((term) => term.courses.map((course) => course.code)));
  for (const exception of record.satisfiedByException) {
    if (exception.code && exception.satisfies && taken.has(exception.code)) taken.add(exception.satisfies);
  }

  return {
    profile,
    program,
    record,
    slots: openSlots(program, record),
    history,
    lastRecordTerm: [...record.terms].sort((a, b) => termOrder(a.term) - termOrder(b.term)).at(-1)?.term ?? "Spring 2027",
    recordCredits: history.reduce((sum, term) => sum + term.credits, 0),
    taken,
    rows,
    kindOf,
    fillsOf,
  };
}

const MODELS = new Map<ProfileId, Model>();

/* Built once per profile: it reads the whole record and requirement tree. */
export function modelFor(profile: ProfileId): Model {
  let model = MODELS.get(profile);
  if (!model) {
    model = buildModel(profile);
    MODELS.set(profile, model);
  }
  return model;
}

/* ---------- Cards ---------- */

export type Card = {
  id: string;
  slot: OpenSlot;
  /* The chosen course; null for a slot with no course to suggest ("Choose a course"). */
  code: string | null;
  title: string;
  credits: number;
  kind: Kind;
  /* What it counts for: "Business elective · 2 of 3", "Gen ed · World Society". */
  fills: string;
  /* Courses the student can pick for this card, the chosen one first. */
  options: string[];
};

/* A placeholder code for a card with no course, so progress can still count the slot. */
export const PLACEHOLDER = "TBD:";

function fillsLabel(slot: OpenSlot, row: RequirementProgress | undefined): string {
  const count = /^(.*) \((\d+) of (\d+)\)$/.exec(slot.label);
  if (count) return `${count[1]} · ${count[2]} of ${count[3]}`;
  const label = row?.label ?? slot.label;
  return row?.group === "gened" ? `Gen ed · ${label}` : label;
}

export type Choices = Record<string, string>;

/* The honors twin of a course (MKTG 2901 for MKTG 2101) or the other way round. */
function twin(code: string): string | null {
  const [subject, number] = code.split(" ");
  if (!number || (number[1] !== "1" && number[1] !== "9")) return null;
  return `${subject} ${number[0]}${number[1] === "9" ? "1" : "9"}${number.slice(2)}`;
}

/* A slot's choices, less what would not count: zero-credit courses and the twin of a course already taken. */
function usableOptions(model: Model, slot: OpenSlot): string[] {
  return slot.options.filter((code) => {
    if (catalogCredits(code) === 0) return false;
    const other = twin(code);
    return !other || !model.taken.has(other);
  });
}

export function cardsFor(model: Model, choices: Choices): Card[] {
  return model.slots.map((slot) => {
    const usable = usableOptions(model, slot);
    const chosen = choices[slot.id];
    const named = CODE.exec(slot.label)?.[0];
    const code = chosen && usable.includes(chosen)
      ? chosen
      : usable[0] ?? (named && !model.taken.has(named) ? named : null);
    const options = code && usable.includes(code) ? [code, ...usable.filter((option) => option !== code)] : usable;
    return {
      id: slot.id,
      slot,
      code,
      title: (code && courseTitle(code)) ?? (code ? "Title not in the bulletin data" : "Choose a course"),
      /* A lab course can carry 0 on its own card; the slot's credits are what the requirement counts. */
      credits: (code && catalogCredits(code)) || slot.credits,
      kind: slot.kind,
      fills: fillsLabel(slot, model.rows.get(slot.requirement)),
      options,
    };
  });
}

export function placedCode(card: Card) {
  return card.code ?? `${PLACEHOLDER}${card.id}`;
}

/* ---------- Sequencing: prerequisites and class standing ---------- */

type Tri = true | false | null;

/*
 * Three-valued, like the finder's: a course leaf is met when taken earlier (or this term,
 * where the bulletin allows "concurrently"). Placement tests are unknown. A zero-credit
 * course the board never carries (MIS 3001, professional development, which Allegra's
 * catalog-year audit does not list) is unknown too: the advisor's call, not a gap.
 */
function evaluate(e: Expr, earlier: ReadonlySet<string>, same: ReadonlySet<string>): Tri {
  if ("op" in e) {
    const results = e.of.map((x) => evaluate(x, earlier, same));
    if (e.op === "all") return results.includes(false) ? false : results.includes(null) ? null : true;
    return results.includes(true) ? true : results.includes(null) ? null : false;
  }
  if (e.kind === "placement") return null;
  if (e.kind === "course") {
    if (earlier.has(e.code) || (e.concurrent && same.has(e.code))) return true;
    return catalogCredits(e.code) === 0 ? null : false;
  }
  const pool = [...earlier, ...(e.concurrent ? same : [])];
  return pool.some((code) => {
    const [subject, number] = code.split(" ");
    return subject === e.subject && Number(number) >= Number(e.from) && Number(number) <= Number(e.to);
  });
}

/* The unmet AND groups, each as its first two options: [["FIN 3101", "FIN 3901"]]. */
function unmetGroups(e: Expr, earlier: ReadonlySet<string>, same: ReadonlySet<string>): string[][] {
  const groups = "op" in e && e.op === "all" ? e.of : [e];
  return groups
    .filter((group) => evaluate(group, earlier, same) === false)
    .map((group) => leafCodes(group).slice(0, 2));
}

function leafCodes(e: Expr): string[] {
  if ("op" in e) return e.of.flatMap(leafCodes);
  if (e.kind === "course") return [e.code];
  if (e.kind === "subjectRange") return [`${e.subject} ${e.from}–${e.to}`];
  return [];
}

/* Unknown leaves worth naming: the untracked zero-credit courses ("MIS 3001"). */
function unknownCodes(e: Expr, earlier: ReadonlySet<string>, same: ReadonlySet<string>): string[] {
  if ("op" in e) {
    if (evaluate(e, earlier, same) !== null) return [];
    return e.of.flatMap((x) => unknownCodes(x, earlier, same));
  }
  return e.kind === "course" && evaluate(e, earlier, same) === null ? [e.code] : [];
}

/* "Senior 90 to 119 Credits, Senior/Fifth Year 120+ Credits" → whether a credit count may enroll. */
function standingRule(code: string): { allows: (credits: number) => boolean; text: string } | null {
  const text = CATALOG[code]?.restrictions?.["Class Restrictions"];
  if (!text) return null;
  const ranges = [...text.matchAll(/(\d+)(?: to (\d+)|\+) Credits/g)].map((m) => [Number(m[1]), m[2] ? Number(m[2]) : Infinity] as const);
  if (!ranges.length) return null;
  const inside = (credits: number) => ranges.some(([lo, hi]) => credits >= lo && credits <= hi);
  const must = text.startsWith("Must");
  const minimum = Math.min(...ranges.map(([lo]) => lo));
  const classes = [...new Set([...text.matchAll(/(Freshman|Sophomore|Junior|Senior)/g)].map((m) => m[1]))];
  return {
    allows: (credits) => (must ? inside(credits) : !inside(credits)),
    text: must ? `${classes[0] ?? "Upper"} standing (${minimum}+ credits)` : `Not open at ${classes.join(" or ")} standing`,
  };
}

/* A 4000-level course, or one only seniors may take, belongs late in the plan. */
function isLate(code: string | null) {
  if (!code) return false;
  const number = Number(code.split(" ")[1]);
  return number >= 4000 || !!standingRule(code)?.text.startsWith("Senior");
}

/* The capstone is recommended in the final semester (MIS 4596, writing intensive). */
function isFinal(card: Card) {
  return /capstone/.test(card.slot.requirement);
}

export type Issue =
  | { state: "missing"; text: string; detail: string }
  | { state: "check"; text: string; detail: string };

export type Placement = Record<string, string>;

/*
 * Whether each placed card can be taken in its term: prerequisites against the record (with
 * the audit's equivalences) and every card in an earlier term, then class standing from the
 * credits the student will have by then.
 */
export function sequenceIssues(model: Model, cards: Card[], placement: Placement, before: ReadonlySet<string> = model.taken): Map<string, Issue> {
  const issues = new Map<string, Issue>();
  const terms = [...new Set(Object.values(placement).filter((term) => term !== TRAY))].sort((a, b) => termOrder(a) - termOrder(b));
  const earlier = new Set(before);
  const where = new Map(cards.flatMap((card) => (card.code ? [[card.code, placement[card.id]] as const] : [])));
  let credits = model.recordCredits;
  for (const term of terms) {
    const here = cards.filter((card) => placement[card.id] === term);
    const same = new Set(here.flatMap((card) => (card.code ? [card.code] : [])));
    for (const card of here) {
      if (!card.code) continue;
      const prerequisite = CATALOG[card.code]?.prerequisites;
      const expression = prerequisite?.expression;
      const result = expression ? evaluate(expression, earlier, same) : true;
      if (expression && result === false) {
        /* Name the option the board already holds ("FIN 3101"), else the first two ("ECON 1101 or ECON 1901"). */
        const parts = unmetGroups(expression, earlier, same).map((group) => {
          const planned = group.find((code) => where.has(code));
          return planned ? { text: planned, term: where.get(planned)! } : { text: group.join(" or "), term: null };
        });
        const terms = [...new Set(parts.flatMap((part) => (part.term ? [part.term === TRAY ? "still to place" : part.term] : [])))];
        const when = terms.length ? ` (${terms.join(", ")})` : "";
        issues.set(card.id, {
          state: "missing",
          text: `Needs ${parts.map((part) => part.text).join(" and ")} first${when}`,
          detail: prerequisite!.raw,
        });
        continue;
      }
      const standing = standingRule(card.code);
      if (standing && !standing.allows(credits)) {
        issues.set(card.id, {
          state: "missing",
          text: `Needs ${standing.text.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}; you’ll have ${credits}`,
          detail: CATALOG[card.code]?.restrictions?.["Class Restrictions"] ?? "",
        });
        continue;
      }
      if (expression && result === null) {
        const unknown = [...new Set(unknownCodes(expression, earlier, same))];
        issues.set(card.id, {
          state: "check",
          text: unknown.length ? `Check with your advisor: ${unknown.slice(0, 2).join(", ")}` : "Check with your advisor",
          detail: prerequisite!.raw,
        });
      }
    }
    for (const code of same) earlier.add(code);
    credits += here.reduce((sum, card) => sum + card.credits, 0);
  }
  return issues;
}

/* ---------- autoPlace ---------- */

export type Preferences = { graduationTerm: string; creditsPerTerm: number; summers: boolean };

export type AutoPlan = {
  cards: Card[];
  placement: Placement;
  /* Cards the plan meets every requirement without (a minor course already counts as a business elective). */
  optional: Set<string>;
  /* The open terms autoPlace used, in order. */
  terms: string[];
  /* The regular term the student aims to finish in, as read from preferences. */
  goal: string;
};

const KIND_ORDER: Record<Kind, number> = { core: 0, gened: 1, elective: 2, "free-elective": 3 };

function placedCourses(cards: Card[], placement: Placement): PlacedCourse[] {
  return cards.flatMap((card) => {
    const term = placement[card.id];
    return term && term !== TRAY ? [{ code: placedCode(card), credits: card.credits, term, slot: card.id }] : [];
  });
}

/* Missing credits per requirement and in total: equal keys mean the plan is no worse. */
function shortfall(model: Model, cards: Card[]): string {
  const everywhere = Object.fromEntries(cards.map((card) => [card.id, "Fall 2099"]));
  const progress = graduationProgress(model.program, model.record, placedCourses(cards, everywhere));
  return [progress.totalCredits.missing, ...progress.requirements.map((row) => row.missingCredits)].join(",");
}

/* The first term after the record, and every term through the goal (summers when chosen). */
export function termsThrough(model: Model, last: string, summers: boolean): string[] {
  const terms: string[] = [];
  let term = nextTerm(model.lastRecordTerm, summers);
  for (let guard = 0; guard < 30 && termOrder(term) <= termOrder(last); guard++) {
    terms.push(term);
    term = nextTerm(term, summers);
  }
  return terms;
}

export function termAfter(term: string, summers: boolean) {
  return nextTerm(term, summers);
}

/* The goal as a regular term on or after the first open term. */
function goalTerm(model: Model, prefs: Preferences): string {
  const first = nextTerm(model.lastRecordTerm, false);
  const goal = parseTerm(prefs.graduationTerm) && !isSummer(prefs.graduationTerm) ? prefs.graduationTerm : first;
  return termOrder(goal) < termOrder(first) ? first : goal;
}

/*
 * Lays the open cards into the terms ahead. Deterministic: the same record, preferences
 * and choices always give the same board.
 *
 * 1. Optional cards: walking the cards from last to first, a card whose removal leaves every
 *    requirement and the credit total as they were stays in the tray as optional.
 * 2. Terms: every term from the first open one through the goal (summers only when chosen),
 *    or fewer when the target load finishes sooner; more past the goal only when even 18
 *    credits a term cannot fit everything.
 * 3. The capstone goes in the final term; other late courses (4000-level, seniors only) too.
 * 4. Term by term, the cards whose prerequisites are met by the record and earlier terms,
 *    in order: those that unlock other cards, then core, gen ed, elective, free elective.
 *    A term fills to the target (the student's credits a term, raised toward 18 only as far
 *    as the goal needs), past it up to 18 only when later terms could not take the rest.
 * 5. Whatever still does not fit goes to the earliest term with room, else a term past the goal.
 */
export function autoPlace(model: Model, prefs: Preferences, choices: Choices): AutoPlan {
  const cards = cardsFor(model, choices);
  const goal = goalTerm(model, prefs);

  const optional = new Set<string>();
  const baseline = shortfall(model, cards);
  for (const card of [...cards].reverse()) {
    const without = cards.filter((other) => other !== card && !optional.has(other.id));
    if (shortfall(model, without) === baseline) optional.add(card.id);
  }
  const toPlace = cards.filter((card) => !optional.has(card.id));
  const total = toPlace.reduce((sum, card) => sum + card.credits, 0);

  /* 2. Terms and the per-term target. */
  const target = Math.min(CREDIT_MAX, Math.max(CREDIT_MIN, prefs.creditsPerTerm));
  const throughGoal = termsThrough(model, goal, prefs.summers);
  const regular = throughGoal.filter((term) => !isSummer(term)).length || 1;
  const summerRoom = throughGoal.filter(isSummer).length * SUMMER_TARGET;
  const soft = Math.min(CREDIT_MAX, Math.max(target, Math.ceil((total - summerRoom) / regular)));
  const cap = (term: string) => (isSummer(term) ? SUMMER_TARGET : soft);
  const hard = (term: string) => (isSummer(term) ? SUMMER_MAX : CREDIT_MAX);

  const terms: string[] = [];
  let room = 0;
  for (const term of throughGoal) {
    if (room >= total && terms.length) break;
    terms.push(term);
    room += cap(term);
  }
  const hardRoom = () => terms.reduce((sum, term) => sum + hard(term), 0);
  while (hardRoom() < total && terms.length < throughGoal.length + EXTRA_TERMS) {
    terms.push(nextTerm(terms.at(-1) ?? model.lastRecordTerm, prefs.summers));
  }
  if (!terms.length) terms.push(goal);
  const final = [...terms].reverse().find((term) => !isSummer(term)) ?? terms.at(-1)!;

  const placement: Placement = Object.fromEntries(cards.map((card) => [card.id, TRAY]));
  const load = new Map(terms.map((term) => [term, 0]));
  const put = (card: Card, term: string) => {
    placement[card.id] = term;
    load.set(term, (load.get(term) ?? 0) + card.credits);
  };

  /* Codes a card's prerequisite names, to rank the cards that unlock others first. */
  const unlocks = (card: Card) =>
    card.code
      ? toPlace.filter((other) => {
          const e = other.code ? CATALOG[other.code]?.prerequisites?.expression : null;
          return !!e && leafCodes(e).includes(card.code!);
        }).length
      : 0;
  const order = new Map(toPlace.map((card, index) => [card.id, index]));
  const ranked = [...toPlace].sort((a, b) =>
    unlocks(b) - unlocks(a) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || order.get(a.id)! - order.get(b.id)!);

  /* A prerequisite nothing on the record or board can meet never holds a card back. */
  const everything = new Set([...model.taken, ...toPlace.flatMap((card) => (card.code ? [card.code] : []))]);
  const satisfiable = (card: Card) => {
    const e = card.code ? CATALOG[card.code]?.prerequisites?.expression : null;
    return !e || evaluate(e, everything, everything) !== false;
  };
  const earlierThan = (term: string) =>
    new Set([...model.taken, ...toPlace.flatMap((card) =>
      card.code && placement[card.id] !== TRAY && termOrder(placement[card.id]) < termOrder(term) ? [card.code] : [])]);
  const creditsBefore = (term: string) =>
    model.recordCredits + toPlace.filter((card) => placement[card.id] !== TRAY && termOrder(placement[card.id]) < termOrder(term))
      .reduce((sum, card) => sum + card.credits, 0);
  const ready = (card: Card, term: string) => {
    if (!card.code) return true;
    const e = CATALOG[card.code]?.prerequisites?.expression;
    const same = new Set(toPlace.flatMap((other) => (other.code && placement[other.id] === term ? [other.code] : [])));
    if (e && satisfiable(card) && evaluate(e, earlierThan(term), same) === false) return false;
    const standing = standingRule(card.code);
    return !standing || standing.allows(creditsBefore(term));
  };

  /* 3. The capstone, then other late courses, in the final term. */
  for (const card of ranked) {
    if (isFinal(card) || isLate(card.code)) {
      if ((load.get(final) ?? 0) + card.credits <= hard(final)) put(card, final);
    }
  }

  /* 4. Term by term. */
  const unplaced = () => ranked.filter((card) => placement[card.id] === TRAY);
  terms.forEach((term, index) => {
    const later = terms.slice(index + 1).reduce((sum, next) => sum + Math.max(cap(next) - (load.get(next) ?? 0), 0), 0);
    /* The second pass may go past the target; compared by pass, since the target can equal 18. */
    for (const [pass, limit] of [cap(term), hard(term)].entries()) {
      for (const card of unplaced()) {
        if (pass === 1) {
          const remaining = unplaced().reduce((sum, item) => sum + item.credits, 0);
          if (remaining <= later) break;
        }
        if (isLate(card.code) && term !== final && terms.indexOf(final) > index) continue;
        if ((load.get(term) ?? 0) + card.credits > limit) continue;
        if (!ready(card, term)) continue;
        put(card, term);
      }
    }
  });

  /* 5. Leftovers: the earliest term with room, else a term past the goal. */
  for (const card of unplaced()) {
    const fits = terms.find((term) => (load.get(term) ?? 0) + card.credits <= hard(term) && ready(card, term))
      ?? terms.find((term) => (load.get(term) ?? 0) + card.credits <= hard(term));
    if (fits) {
      put(card, fits);
      continue;
    }
    const extra = nextTerm(terms.at(-1)!, prefs.summers);
    terms.push(extra);
    load.set(extra, 0);
    put(card, extra);
  }

  return { cards, placement, optional, terms, goal };
}

/* ---------- The board: autoPlace plus the student's moves ---------- */

export type Moves = Record<string, string>;

export type Board = {
  cards: Card[];
  placement: Placement;
  optional: Set<string>;
  /* Open terms on the board, in order: autoPlace's, the goal, and any a move reached. */
  openTerms: string[];
  /* The term a drag or "Move to" may add after the last open one. */
  nextTerm: string;
  goal: string;
  placed: PlacedCourse[];
  issues: Map<string, Issue>;
};

/* A move survives only into an open term this board could show (no summer when summers are off). */
function validMove(model: Model, term: string, prefs: Preferences, goal: string): boolean {
  if (term === TRAY) return true;
  const parsed = parseTerm(term);
  if (!parsed || (isSummer(term) && !prefs.summers)) return false;
  if (termOrder(term) <= termOrder(model.lastRecordTerm)) return false;
  const reach = termsThrough(model, goal, prefs.summers).length + EXTRA_TERMS + 2;
  return termsThrough(model, term, prefs.summers).length <= reach;
}

export function resolveBoard(
  model: Model,
  prefs: Preferences,
  auto: AutoPlan,
  moves: Moves,
  /* Courses already planned for the registered term on /plan (Rafiat). */
  current: string[] = [],
): Board {
  const placement: Placement = { ...auto.placement };
  for (const card of auto.cards) {
    const move = moves[card.id];
    if (move && validMove(model, move, prefs, auto.goal)) placement[card.id] = move;
  }
  const used = Object.values(placement).filter((term) => term !== TRAY);
  const last = [auto.goal, ...auto.terms, ...used].sort((a, b) => termOrder(a) - termOrder(b)).at(-1)!;
  const openTerms = termsThrough(model, last, prefs.summers);
  const before = new Set([...model.taken, ...current]);
  return {
    cards: auto.cards,
    placement,
    optional: auto.optional,
    openTerms,
    nextTerm: nextTerm(last, prefs.summers),
    goal: auto.goal,
    placed: placedCourses(auto.cards, placement),
    issues: sequenceIssues(model, auto.cards, placement, before),
  };
}
