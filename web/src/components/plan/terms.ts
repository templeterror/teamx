import { courses, suggestedPlan } from "@/data";
import { agi, college, dataScience, databases, os, society, webApps, writing } from "./data";

export const CURRENT_TERM = "Spring 2027";

/*
 * Closed terms are a record, not a plan. Their courses come from the bulletin's
 * suggested plan, so they are a sample, not a transcript. Any course that is in
 * the Spring 2027 plan is left out, so the record never claims it was taken.
 */
const CLOSED = [
  { name: "Fall 2026", year: 3, term: "Fall" },
  { name: "Spring 2026", year: 2, term: "Spring" },
  { name: "Fall 2025", year: 2, term: "Fall" },
] as const;

const inCurrentPlan = new Set(
  [os, writing, databases, dataScience, agi, webApps, college, society].map((c) => c.code),
);

export type RecordRow = { code: string | null; title: string; credits: number };

export type ClosedTerm = { name: string; slug: string; rows: RecordRow[]; credits: number };

function slugify(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function titleFor(code: string) {
  const course = (courses as Record<string, { title: string } | undefined>)[code];
  return course?.title ?? code;
}

export const closedTerms: ClosedTerm[] = CLOSED.map(({ name, year, term }) => {
  const source = suggestedPlan.years
    .find((y) => y.year === year)
    ?.terms.find((t) => t.term === term);
  const rows: RecordRow[] = (source?.rows ?? []).flatMap((row) => {
    const code =
      "code" in row && row.code
        ? row.code
        : "courses" in row && row.courses?.length
          ? row.courses[0]
          : null;
    if (code && inCurrentPlan.has(code)) return [];
    /* Ranges (lab science, free electives) record the low end, as a finished term would. */
    const credits = typeof row.credits === "number" ? row.credits : row.credits.min;
    return [{ code, title: code ? titleFor(code) : row.label, credits }];
  });
  return {
    name,
    slug: slugify(name),
    rows,
    credits: rows.reduce((sum, row) => sum + row.credits, 0),
  };
});

export function closedTerm(slug: string) {
  return closedTerms.find((t) => t.slug === slug);
}

export function closedTermByName(name: string) {
  return closedTerms.find((t) => t.name === name);
}
