import { courses, programs, sections, type ProgramCode } from "@/data";
import { studentFor } from "@/components/student/student";

export type Day = "Mon" | "Tue" | "Wed" | "Thu" | "Fri";

export type Offering = {
  code: string;
  title: string;
  credits: number;
  days: Day[];
  start: number;
  end: number;
  why: string;
};

type CourseLike = { code: string; title: string; credits: { value?: number } };
type SectionLike = { course: string; days: string[]; start: string; end: string };

const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/* A course at the meeting time of one of its sections. The finder builds its rows the same way. */
export function sectionOffering(course: CourseLike, section: SectionLike, why: string): Offering {
  return {
    code: course.code,
    title: course.title,
    credits: course.credits.value ?? 0,
    days: section.days.map((d) => d.slice(0, 3) as Day),
    start: minutes(section.start),
    end: minutes(section.end),
    why,
  };
}

/* The placeholder section in sections.json for a course in courses.json. */
export function offeringFor(code: string, why: string): Offering {
  const course = (courses as Record<string, CourseLike | undefined>)[code];
  const section = (sections as SectionLike[]).find((s) => s.course === code);
  if (!course || !section) throw new Error(`${code} needs a course and a section`);
  return sectionOffering(course, section, why);
}

/*
 * Spring 2027. The first five are what the student registered for; the rest are the
 * "Or" options beside them. Each option is open to this student (prerequisites met
 * by completed or in-progress courses) and meets at a time none of the five does.
 */

/* Core */
export const softwareDesign = offeringFor("CIS 3296", "Required. Writing intensive.");

/* Elective slot: CIS 4526 */
export const machineLearning = offeringFor("CIS 4526", "Major elective. Prerequisites met.");
export const dataScience = offeringFor("CIS 3715", "Major elective. Prerequisites met.");
export const dataIntensive = offeringFor("CIS 4517", "Major elective. Prerequisites met.");

/* Elective slot: CIS 4360 */
export const seminar = offeringFor("CIS 4360", "Major elective. Prerequisites met.");
export const compilers = offeringFor("CIS 4324", "Major elective. Prerequisites met.");
export const microservices = offeringFor("CIS 3523", "Major elective. Prerequisites met.");

/* The elective that takes Software Design's place when it moves to a later term */
export const webApps = offeringFor("CIS 3308", "Major elective. Prerequisites met.");
export const automata = offeringFor("CIS 3211", "Major elective. Prerequisites met.");

/* Gen ed slot: Arts */
export const meaningOfArts = offeringFor("PHIL 0847", "Gen ed · Arts.");
export const sacredSpace = offeringFor("ARTH 0803", "Gen ed · Arts.");
export const shakespeareMovies = offeringFor("ENG 0822", "Gen ed · Arts.");

/* Gen ed slot: U.S. Society */
export const whyCollege = offeringFor("AMST 0855", "Gen ed · U.S. Society.");
export const socialMovements = offeringFor("COMC 0801", "Gen ed · U.S. Society.");
export const constitution = offeringFor("LAWU 0825", "Gen ed · U.S. Society.");

/* Every Offering above, so the finder and the record agree with the plan. */
export const PLAN_OFFERINGS: Offering[] = [
  softwareDesign,
  machineLearning,
  dataScience,
  dataIntensive,
  seminar,
  compilers,
  microservices,
  webApps,
  automata,
  meaningOfArts,
  sacredSpace,
  shakespeareMovies,
  whyCollege,
  socialMovements,
  constitution,
];

/* ---------- A student with no registration ---------- */

/*
 * The plan above is Rafiat's Spring 2027 registration. A student with no registered
 * term (the new MIS student) opens instead on the first term of their program's
 * suggested plan, planned for the same Spring 2027:
 *   - a course row is a Required course;
 *   - a "one of" row is one card with the rest as its "Or" options (a gen ed when the
 *     row names its area, else Required);
 *   - placeholder rows (GenEd breadth, electives) are left out: the plan has no empty
 *     slot to show them in, so the student finds those on /find.
 * Nothing here is made up: every course is the suggested plan's, at its placeholder section.
 */
export type StartSlot = { id: string; kind: "core" | "gened"; options: Offering[] };

type ReqNode = { title?: string; kind: string; code?: string; children?: ReqNode[] };
type PlanRow = { kind: string; label?: string; code?: string; courses?: string[]; genEd?: string };

/* The title of the requirement that names `code` ("Lower-division foundation"), for the reason line. */
function requirementTitle(nodes: ReqNode[], code: string, parent?: string): string | undefined {
  for (const n of nodes) {
    if (n.kind === "course" && n.code === code) return n.title ?? parent;
    const hit = n.children && requirementTitle(n.children, code, n.title ?? parent);
    if (hit) return hit;
  }
  return undefined;
}

/* Only courses with a card and a placeholder section can sit in the week. */
function offeringIfListed(code: string, why: string): Offering[] {
  const known = code in courses && (sections as SectionLike[]).some((s) => s.course === code);
  return known ? [offeringFor(code, why)] : [];
}

function seed(program: ProgramCode): StartSlot[] {
  const { degree, plan } = programs[program];
  const requirements = (degree as unknown as { requirements: ReqNode[] }).requirements;
  const rows = (plan as unknown as { years: { terms: { rows: PlanRow[] }[] }[] }).years[0]?.terms[0]?.rows ?? [];
  return rows.flatMap((row, i): StartSlot[] => {
    if (row.kind === "course" && row.code) {
      const title = requirementTitle(requirements, row.code);
      const options = offeringIfListed(row.code, title ? `Required. ${title}.` : "Required.");
      return options.length ? [{ id: `start-${i}`, kind: "core", options }] : [];
    }
    if (row.kind === "oneOf" && row.courses) {
      const why = row.genEd ? `Gen ed · ${row.label}.` : `Required. ${row.label}.`;
      const options = row.courses.flatMap((code) => offeringIfListed(code, why));
      return options.length ? [{ id: `start-${i}`, kind: row.genEd ? "gened" : "core", options }] : [];
    }
    return [];
  });
}

/* Whether the student opens on their own registration (the plan above) rather than a seed. */
export function opensOnRegistration(program: ProgramCode) {
  return studentFor(program).record.terms.some((t) => t.status === "registered");
}

const SEEDS = new Map<ProgramCode, StartSlot[]>();

/* Built once per program, so every render hands the plan the same Offering objects. */
export function startingSlots(program: ProgramCode): StartSlot[] {
  let slots = SEEDS.get(program);
  if (!slots) {
    slots = seed(program);
    SEEDS.set(program, slots);
  }
  return slots;
}

/* Every Offering the student's plan can open with, so the finder agrees with it. */
export function startingOfferings(program: ProgramCode): Offering[] {
  return opensOnRegistration(program) ? PLAN_OFFERINGS : startingSlots(program).flatMap((s) => s.options);
}

export const DAY_START = 9 * 60;
export const DAY_END = 17 * 60;
export const CREDIT_MIN = 12;
export const CREDIT_MAX = 18;
