import { courses, programs, type CourseCode, type ProgramCode } from "@/data";
import { sequencePrerequisite } from "@/components/finder/catalog";

export const COMPLETED = "completed";
export const UNPLANNED = "unplanned";

export type Card = {
  id: string;
  term: string;
  label: string;
  options: string[];
  credits: { min: number; max: number };
};

export type Choice = { term: string; code: string };
export type Board = Record<string, Choice>;

/* The suggested plan for one program; the board is built from its rows. */
function buildBoard(program: ProgramCode) {
  const suggestedPlan = programs[program].plan;

  const years = suggestedPlan.years.map(({ year, terms }) => ({
    year,
    terms: [
      ...terms.map((term) => ({ ...term, id: `${year}-${term.term}` })),
      ...(year < suggestedPlan.years.length
        ? [{ term: "Summer", id: `${year}-Summer`, rows: [] }]
        : []),
    ],
  }));

  const terms = years.flatMap(({ year, terms }) =>
    terms.map(({ id, term }) => ({ id, label: `Year ${year} · ${term}` })),
  );

  const cards: Card[] = years.flatMap(({ terms }) =>
    terms.flatMap(({ id, rows }) =>
      rows.map((row, index) => ({
        id: `${id}-${index}`,
        term: id,
        label: row.label,
        options: "code" in row && row.code ? [row.code] : ("courses" in row ? row.courses ?? [] : []),
        credits: typeof row.credits === "number"
          ? { min: row.credits, max: row.credits }
          : row.credits,
      })),
    ),
  );

  const starterBoard: Board = Object.fromEntries(
    cards.map((card) => [card.id, { term: card.term, code: card.options[0] ?? "" }]),
  );

  function readSavedBoard(value: unknown): Board {
    if (!value || typeof value !== "object") return starterBoard;
    return Object.fromEntries(cards.map((card) => {
      const saved: unknown = (value as Record<string, unknown>)[card.id];
      const fallback = starterBoard[card.id];
      if (!saved || typeof saved !== "object") return [card.id, fallback];
      const { code, term } = saved as Partial<Choice>;
      if (typeof code !== "string" || typeof term !== "string") return [card.id, fallback];
      const validTerm = terms.some((item) => item.id === term)
        || term === UNPLANNED || (term === COMPLETED && !!fallback.code);
      const validCode = code === fallback.code || card.options.some((option) => option === code);
      return [card.id, validTerm && validCode ? { term, code } : fallback];
    }));
  }

  function sequenceIssues(board: Board) {
    const issues = new Map<string, NonNullable<ReturnType<typeof sequencePrerequisite>>>();
    const earlier = new Set(Object.values(board).flatMap(({ code, term }) =>
      code && term === COMPLETED ? [code] : [],
    ));

    for (const { id } of terms) {
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

  return { plan: suggestedPlan, years, terms, cards, starterBoard, readSavedBoard, sequenceIssues };
}

export type FourYearBoard = ReturnType<typeof buildBoard>;

const BOARDS = new Map<ProgramCode, FourYearBoard>();

/* The signed-in program's board, built once per program so starterBoard stays one object. */
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

export function totalCredits(list: Card[]) {
  const min = list.reduce((sum, card) => sum + card.credits.min, 0);
  const max = list.reduce((sum, card) => sum + card.credits.max, 0);
  return min === max ? String(min) : `${min}–${max}`;
}
