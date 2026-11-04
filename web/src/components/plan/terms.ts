import { studentRecord } from "@/data";

export const CURRENT_TERM = "Spring 2027";

/*
 * Terms before the one being planned are a record, not a plan. They come from the
 * student's degree audit (data/student-record.json), newest first. A term still in
 * progress is shown as such: its courses are not finished yet.
 */
export type RecordRow = { code: string | null; title: string; credits: number };

export type ClosedTerm = {
  name: string;
  slug: string;
  status: "completed" | "in-progress";
  rows: RecordRow[];
  credits: number;
};

function slugify(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

export const closedTerms: ClosedTerm[] = studentRecord.terms
  .flatMap(({ term, status, courses }) =>
    status === "registered"
      ? []
      : [
          {
            name: term,
            slug: slugify(term),
            status,
            rows: courses.map(({ code, title, credits }) => ({ code, title, credits })),
            credits: courses.reduce((sum, course) => sum + course.credits, 0),
          },
        ],
  )
  .reverse();

/* "Completed" or "In progress", for a term's status line. */
export function termStatusLabel(term: ClosedTerm) {
  return term.status === "in-progress" ? "In progress" : "Completed";
}

export function closedTerm(slug: string) {
  return closedTerms.find((t) => t.slug === slug);
}

export function closedTermByName(name: string) {
  return closedTerms.find((t) => t.name === name);
}
