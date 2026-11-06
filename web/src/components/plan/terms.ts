import { studentRecord } from "@/data";
import { profileFor, type ProfileKey } from "@/components/student/student";

/*
 * The term being planned: the one Rafiat's degree audit shows as registered (Spring 2027).
 * Every student plans it; a new student has no registration of their own to say otherwise.
 */
const registeredTerm = studentRecord.terms.find((t) => t.status === "registered");
if (!registeredTerm) throw new Error("student-record.json needs a registered term to plan");
export const CURRENT_TERM = registeredTerm.term;

/*
 * Terms before the one being planned are a record, not a plan. They come from the
 * student's degree audit (data/student-record.json), newest first; a new student has
 * none. A term still in progress is shown as such: its courses are not finished yet.
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

const CLOSED = new Map<ProfileKey, ClosedTerm[]>();

/* The signed-in student's closed terms, built once per profile. */
export function closedTerms(key: ProfileKey): ClosedTerm[] {
  let terms = CLOSED.get(key);
  if (!terms) {
    terms = profileFor(key)
      .record.terms.flatMap(({ term, status, courses }) =>
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
    CLOSED.set(key, terms);
  }
  return terms;
}

/* "Completed" or "In progress", for a term's status line. */
export function termStatusLabel(term: ClosedTerm) {
  return term.status === "in-progress" ? "In progress" : "Completed";
}

export function closedTerm(key: ProfileKey, slug: string) {
  return closedTerms(key).find((t) => t.slug === slug);
}

export function closedTermByName(key: ProfileKey, name: string) {
  return closedTerms(key).find((t) => t.name === name);
}
