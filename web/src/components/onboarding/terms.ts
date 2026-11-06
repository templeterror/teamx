/*
 * Term arithmetic for onboarding and preferences. Terms are the record's words:
 * "Fall 2024", "Spring 2025", "Summer 2025". Pure, no React.
 */
export type Season = "Spring" | "Summer" | "Fall";
export type Term = { season: Season; year: number };

const SEASONS: readonly Season[] = ["Spring", "Summer", "Fall"];

export function parseTerm(label: string): Term | null {
  const match = /^(Spring|Summer|Fall)\s+(\d{4})$/.exec(label.trim());
  if (!match) return null;
  return { season: match[1] as Season, year: Number(match[2]) };
}

export function termLabel(term: Term) {
  return `${term.season} ${term.year}`;
}

/* Fall and spring only: the next regular term after this one. */
export function nextRegularTerm(term: Term): Term {
  return term.season === "Fall" ? { season: "Spring", year: term.year + 1 } : { season: "Fall", year: term.year };
}

export function previousRegularTerm(term: Term): Term {
  return term.season === "Fall" ? { season: "Spring", year: term.year } : { season: "Fall", year: term.year - 1 };
}

/* Fall and spring terms only, `count` steps on (negative steps back). */
export function shiftRegularTerm(term: Term, count: number): Term {
  let current = term.season === "Summer" ? { season: "Fall" as Season, year: term.year } : term;
  for (let i = 0; i < Math.abs(count); i += 1) {
    current = count > 0 ? nextRegularTerm(current) : previousRegularTerm(current);
  }
  return current;
}

/* For sorting: Spring < Summer < Fall within a year. */
export function termIndex(term: Term) {
  return term.year * 3 + SEASONS.indexOf(term.season);
}

/* The next fall term from a date: this year's while it has not started (before August), else next year's. */
export function nextFall(now: Date): Term {
  return { season: "Fall", year: now.getMonth() < 7 ? now.getFullYear() : now.getFullYear() + 1 };
}

/* Fall and spring terms strictly after `after` up to and including `through`. */
export function regularTermsBetween(after: Term, through: Term): Term[] {
  const list: Term[] = [];
  let current = nextRegularTerm(after.season === "Summer" ? { season: "Spring", year: after.year } : after);
  while (termIndex(current) <= termIndex(through)) {
    list.push(current);
    current = nextRegularTerm(current);
  }
  return list;
}

/* Summer terms strictly after `after` and before `through`. */
export function summersBetween(after: Term, through: Term): Term[] {
  const list: Term[] = [];
  for (let year = after.year; year <= through.year; year += 1) {
    const summer: Term = { season: "Summer", year };
    if (termIndex(summer) > termIndex(after) && termIndex(summer) < termIndex(through)) list.push(summer);
  }
  return list;
}
