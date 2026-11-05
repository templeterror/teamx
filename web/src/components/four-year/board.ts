import { courses, programs, type CourseCode, type ProgramCode } from "@/data";
import { catalogFor, rowKind, sequencePrerequisite, type FinderRow } from "@/components/finder/catalog";
import type { Placement } from "@/components/plan/use-plan";
import { CURRENT_TERM } from "@/components/plan/terms";
import { studentFor } from "@/components/student/student";

export const COMPLETED = "completed";
export const UNPLANNED = "unplanned";
/* A card the record, or this term's plan, has used up. It is off the board. */
export const USED = "used";

/* The same four kinds, and colours, as the week and Your courses on /plan. */
export type Kind = Placement["kind"];

export type Card = {
  id: string;
  term: string;
  label: string;
  kind: Kind;
  /* What an open requirement slot stands for ("Gen ed"); null when the row names a course. */
  slot: string | null;
  options: string[];
  credits: { min: number; max: number };
};

/*
 * Where a board term stands against the student's record. "open" is a term still to plan;
 * every other state is locked: history from the audit, an empty past summer, or the term
 * being planned on /plan right now.
 */
export type TermState = "completed" | "in-progress" | "past" | "current" | "open";

export type BoardTerm = {
  id: string;
  /* "Fall", "Spring", "Summer" */
  season: string;
  /* "Fall 2024" with a record, else the season. */
  name: string;
  /* The Term select's wording: "Year 3 · Summer 2027". */
  label: string;
  state: TermState;
  locked: boolean;
};

/* A course from the record or this term's plan: shown in its term, never moved here. */
export type LockedCourse = {
  id: string;
  code: string;
  title: string;
  credits: number;
  kind: Kind;
  term: string;
  status: "completed" | "in-progress" | "current";
};

export type CurrentCourse = Omit<LockedCourse, "term" | "status">;

const SLOT_LABEL: Record<string, string> = {
  genEd: "Gen ed",
  labScience: "Lab science",
  csElective: "CS elective",
  businessElective: "Business elective",
  freeElective: "Free elective",
};

/* A oneOf row with a genEd area (English, say) counts toward gen ed; any other oneOf is a major course. */
function kindOf(row: { kind: string; genEd?: string }): Kind {
  switch (row.kind) {
    case "genEd": return "gened";
    case "oneOf": return row.genEd ? "gened" : "core";
    case "csElective":
    case "businessElective": return "elective";
    case "freeElective": return "free-elective";
    default: return "core"; // course, labScience
  }
}

export type Choice = { term: string; code: string };
export type Board = Record<string, Choice>;

/* The open audit items' course lists, read loosely: a new student's record has no audit. */
type AuditLike = { audit?: { open?: { from?: string[] }[] } };
const GEN_ED = courses as unknown as Record<string, { genEdAreas?: string[] }>;

/* The suggested plan for one program, laid over the signed-in student's record. */
function buildBoard(program: ProgramCode) {
  const suggestedPlan = programs[program].plan;
  const record = studentFor(program).record;

  /*
   * The record's first term is Year 1 Fall. A record that starts in another season would
   * need a guess about which plan year it is, so the board stays undated instead.
   */
  const firstTerm = /^Fall (\d{4})$/.exec(record.terms[0]?.term ?? "");
  const startYear = firstTerm ? Number(firstTerm[1]) : null;
  const calendarName = (year: number, season: string) =>
    startYear === null ? season : `${season} ${startYear + year - (season === "Fall" ? 1 : 0)}`;
  const history = new Map(
    startYear === null
      ? []
      : record.terms.flatMap((term) => (term.status === "registered" ? [] : [[term.term, term] as const])),
  );

  const rawYears = suggestedPlan.years.map(({ year, terms }) => ({
    year,
    terms: [
      ...terms.map((term) => ({ ...term, id: `${year}-${term.term}` })),
      ...(year < suggestedPlan.years.length
        ? [{ term: "Summer", id: `${year}-Summer`, rows: [] }]
        : []),
    ],
  }));

  /* Chronological, so "before this term" is an index comparison. */
  const dated = rawYears.flatMap(({ year, terms }) =>
    terms.map(({ id, term: season }) => ({ id, year, season, name: calendarName(year, season) })),
  );
  const currentIndex = startYear === null ? -1 : dated.findIndex(({ name }) => name === CURRENT_TERM);
  const lockedThrough = Math.max(currentIndex, ...dated.map(({ name }, index) => (history.has(name) ? index : -1)));

  const terms: BoardTerm[] = dated.map(({ id, year, season, name }, index) => {
    const recorded = history.get(name);
    const state: TermState = recorded
      ? recorded.status === "in-progress" ? "in-progress" : "completed"
      : index === currentIndex ? "current"
        : index < lockedThrough ? "past" : "open";
    return { id, season, name, label: `Year ${year} · ${name}`, state, locked: state !== "open" };
  });
  const termById = new Map(terms.map((term) => [term.id, term]));
  const currentTerm = terms.find((term) => term.state === "current");

  const years = rawYears.map(({ year, terms: yearTerms }) => ({
    year,
    /* "2024–25" once the board is dated. */
    span: startYear === null ? null : `${startYear + year - 1}–${String(startYear + year).slice(-2)}`,
    terms: yearTerms.map(({ id }) => termById.get(id)!),
  }));

  const cards: Card[] = rawYears.flatMap(({ terms: yearTerms }) =>
    yearTerms.flatMap(({ id, rows }) =>
      rows.map((row, index) => {
        const options = "code" in row && row.code ? [row.code] : ("courses" in row ? row.courses ?? [] : []);
        return {
          id: `${id}-${index}`,
          term: id,
          label: row.label,
          kind: kindOf(row),
          slot: options.length ? null : SLOT_LABEL[row.kind] ?? row.label,
          options,
          credits: typeof row.credits === "number"
            ? { min: row.credits, max: row.credits }
            : row.credits,
        };
      }),
    ),
  );

  /* The finder's rows, for what a course counts for. Built once, and only for a student with a record. */
  let rows: Map<string, FinderRow> | undefined;
  function catalogRow(code: string) {
    rows ??= new Map(
      catalogFor(program)
        .buildRows({ placements: [], addCourse: () => {}, toggleCourse: () => {} })
        .map((row) => [row.code, row]),
    );
    return rows.get(code);
  }

  /*
   * A record course takes the kind of the plan card it stands for (CIS 1966 for CIS 1166);
   * otherwise a course with a gen ed area is a gen ed, one the catalog counts toward the
   * program's elective is an elective, and anything else is a free elective.
   */
  function recordKind(code: string): Kind {
    const card = cards.find(({ options }) => options.includes(code));
    if (card) return card.kind;
    if (GEN_ED[code]?.genEdAreas?.length) return "gened";
    if (catalogRow(code)?.countsFor.kind === "major-elective") return "elective";
    return "free-elective";
  }

  const recordCourses: LockedCourse[] = terms.flatMap(({ id, name }) => {
    const recorded = history.get(name);
    if (!recorded) return [];
    const status = recorded.status === "in-progress" ? "in-progress" : "completed";
    return recorded.courses.map(({ code, title, credits }) => ({
      id: `record-${id}-${code}`, code, title, credits, kind: recordKind(code), term: id, status,
    }));
  });

  /* This term's active courses on /plan; a course added from the catalog is coloured by what it counts for. */
  function currentFromPlan(placements: Placement[]): CurrentCourse[] {
    if (!currentTerm) return [];
    return placements
      .filter((placement) => !placement.deferred && !placement.dropped)
      .map(({ id, kind, course }) => {
        const row = id.startsWith("catalog-") ? catalogRow(course.code) : undefined;
        return {
          id: `current-${id}`,
          code: course.code,
          title: course.title,
          credits: course.credits,
          kind: row ? rowKind(row) : kind,
        };
      });
  }

  const openInAudit = new Set((record as AuditLike).audit?.open?.flatMap((item) => item.from ?? []) ?? []);

  /* With no record nothing is used, so this is the suggested plan as it reads. */
  function derive(current: CurrentCourse[]) {
    const locked: LockedCourse[] = [
      ...recordCourses,
      ...(currentTerm ? current.map((course) => ({ ...course, term: currentTerm.id, status: "current" as const })) : []),
    ];

    /*
     * In term order, each course uses up the card it names, else the earliest open slot of
     * its kind. An elective with no elective slot left takes a free elective slot.
     */
    const used = new Map<string, LockedCourse>();
    const countsToward = new Map<string, Card>();
    for (const course of locked) {
      const take = (test: (card: Card) => boolean) => cards.find((card) => !used.has(card.id) && test(card));
      const slot = (kind: Kind) => take((card) => !!card.slot && card.kind === kind);
      const card = take(({ options }) => options.includes(course.code))
        ?? (course.kind === "gened" ? slot("gened") : undefined)
        ?? (course.kind === "elective" ? slot("elective") : undefined)
        ?? (course.kind === "elective" || course.kind === "free-elective" ? slot("free-elective") : undefined);
      if (card) {
        used.set(card.id, course);
        countsToward.set(course.id, card);
      }
    }

    /*
     * What is left in a locked term moves off it: a slot, or a course the audit still lists
     * as open, waits to be placed; any other named course was met another way.
     */
    const starter: Board = {};
    const fixed = new Set<string>();
    const met: Card[] = [];
    for (const card of cards) {
      const code = card.options[0] ?? "";
      const usedBy = used.get(card.id);
      if (usedBy) {
        starter[card.id] = { term: USED, code: usedBy.code };
        fixed.add(card.id);
      } else if (!termById.get(card.term)?.locked) {
        starter[card.id] = { term: card.term, code };
      } else if (card.slot || card.options.some((option) => openInAudit.has(option))) {
        starter[card.id] = { term: UNPLANNED, code };
      } else {
        starter[card.id] = { term: COMPLETED, code };
        fixed.add(card.id);
        met.push(card);
      }
    }

    const lockedByTerm = new Map<string, LockedCourse[]>();
    for (const course of locked) lockedByTerm.set(course.term, [...(lockedByTerm.get(course.term) ?? []), course]);

    return { locked, lockedByTerm, countsToward, starter, fixed, met };
  }

  type Derived = ReturnType<typeof derive>;

  /* A saved board keeps only what the student moved; anything the record decides wins. */
  function resolve(saved: Board, derived: Derived): Board {
    return Object.fromEntries(cards.map((card) => [
      card.id,
      derived.fixed.has(card.id) ? derived.starter[card.id] : saved[card.id] ?? derived.starter[card.id],
    ]));
  }

  /* Only moves into terms still open to planning survive; a locked term is the record's. */
  function readSavedBoard(value: unknown): Board {
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(cards.flatMap((card) => {
      const saved: unknown = (value as Record<string, unknown>)[card.id];
      if (!saved || typeof saved !== "object") return [];
      const { code, term } = saved as Partial<Choice>;
      if (typeof code !== "string" || typeof term !== "string") return [];
      const fallback = card.options[0] ?? "";
      const validTerm = termById.get(term)?.locked === false
        || term === UNPLANNED || (term === COMPLETED && !!fallback);
      const validCode = code === fallback || card.options.includes(code);
      return validTerm && validCode ? [[card.id, { term, code }]] : [];
    }));
  }

  /* Record and this-term courses count as taken in their real terms; the tray is not sequenced. */
  function sequenceIssues(board: Board, derived: Derived) {
    const issues = new Map<string, NonNullable<ReturnType<typeof sequencePrerequisite>>>();
    const earlier = new Set(Object.values(board).flatMap(({ code, term }) =>
      code && term === COMPLETED ? [code] : [],
    ));

    for (const { id, locked } of terms) {
      if (locked) {
        for (const { code } of derived.lockedByTerm.get(id) ?? []) earlier.add(code);
        continue;
      }
      const scheduled = Object.entries(board).filter(([, choice]) => choice.term === id && choice.code);
      const sameTerm = new Set(scheduled.map(([, choice]) => choice.code));
      for (const [cardId, { code }] of scheduled) {
        const issue = sequencePrerequisite(code, earlier, sameTerm);
        if (issue) issues.set(cardId, issue);
      }
      for (const code of sameTerm) earlier.add(code);
    }

    return issues;
  }

  return {
    plan: suggestedPlan,
    hasRecord: startYear !== null,
    years,
    terms,
    openTerms: terms.filter(({ locked }) => !locked),
    cards,
    currentFromPlan,
    derive,
    resolve,
    readSavedBoard,
    sequenceIssues,
  };
}

export type FourYearBoard = ReturnType<typeof buildBoard>;
export type DerivedBoard = ReturnType<FourYearBoard["derive"]>;

const BOARDS = new Map<ProgramCode, FourYearBoard>();

/* The signed-in program's board, built once per program so its functions stay one object. */
export function boardFor(program: ProgramCode): FourYearBoard {
  let board = BOARDS.get(program);
  if (!board) {
    board = buildBoard(program);
    BOARDS.set(program, board);
  }
  return board;
}

export function courseTitle(code: string) {
  return courses[code as CourseCode]?.title;
}

type Credited = { credits: number | { min: number; max: number } };

export function totalCredits(list: Credited[]) {
  const range = (item: Credited) => typeof item.credits === "number"
    ? { min: item.credits, max: item.credits }
    : item.credits;
  const min = list.reduce((sum, item) => sum + range(item).min, 0);
  const max = list.reduce((sum, item) => sum + range(item).max, 0);
  return min === max ? String(min) : `${min}–${max}`;
}
