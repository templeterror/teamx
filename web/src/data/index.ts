import academicPlan from "./academic-plan.json";
import courseCatalog from "./courses.json";
import misAcademicPlan from "./mis-academic-plan.json";
import misProgram from "./mis-program.json";
import misRecord from "./mis-student-record.json";
import program from "./program.json";
import sectionCatalog from "./sections.json";
import record from "./student-record.json";

export const bulletinYear = "2026-2027" as const;
export const courses = courseCatalog.courses;
export const degree = program;
export const suggestedPlan = academicPlan;
export const sections = sectionCatalog.sections;

/*
 * Every program in the catalog, by program code. `degree` and `suggestedPlan` above stay
 * the Computer Science BS, the default student's program; anything that depends on which
 * student is signed in reads `programs` through components/student/student.ts.
 */
export const programs = {
  "ST-CSCI-BS": { degree: program, plan: academicPlan },
  "BU-MIS-BBA": { degree: misProgram, plan: misAcademicPlan },
} as const;

export type ProgramCode = keyof typeof programs;
export type ProgramData = (typeof programs)[ProgramCode];

/* Rafiat's program. Sign-in starts on it, and anything outside a chosen student falls back to it. */
export const DEFAULT_PROGRAM: ProgramCode = "ST-CSCI-BS";

export function isProgramCode(value: unknown): value is ProgramCode {
  return typeof value === "string" && Object.hasOwn(programs, value);
}

export type CourseCode = keyof typeof courses;

export type RecordStatus = "completed" | "in-progress" | "registered";
/* `status` only where a course differs from its term (BA 2101: graded inside Allegra's in-progress Fall 2026). */
export type RecordCourse = { code: string; title: string; credits: number; status?: RecordStatus };
export type RecordTerm = { term: string; status: RecordStatus; courses: RecordCourse[] };

/*
 * One item the degree audit still shows as open. `requirement` names the program tree node;
 * an item outside the program (a minor, University Honors) has `track` instead. `needs` is
 * the audit's wording. `courses`/`credits` are the same need as numbers, and `from`/`pool`
 * what can fill it ("MKTG 3***" is any MKTG 3000-level course); a record may leave any of
 * them out (Rafiat's items carry the wording only).
 */
export type AuditOpenItem = {
  requirement?: string;
  track?: string;
  label: string;
  needs: string;
  courses?: number;
  credits?: number;
  from?: string[];
  pool?: string[];
  note?: string;
};

export type StudentAudit = {
  credits: { required: number; earned: number; inProgress: number; needed: number };
  open: AuditOpenItem[];
  /* The courses the audit used for each section it shows as met or in progress, by tree node. */
  applied?: { requirement: string; codes: string[] }[];
  notes?: string[];
};

/*
 * A course the audit applies where the bulletin tree would not on its own. `code` is the
 * course taken, `satisfies` the course it stands in for, when the audit names one.
 */
export type SatisfiedByException = { requirement: string; note: string; code?: string; satisfies?: string };

/*
 * The shape both records share. Both come from a real DARS audit (no ID, grades or GPA),
 * so both carry the audit's numbers and open items.
 */
export type StudentRecord = {
  source: string;
  student: string | null;
  program: ProgramCode;
  catalogYear: string | null;
  minor: string | null;
  terms: RecordTerm[];
  satisfiedByException: SatisfiedByException[];
  audit?: StudentAudit;
};

/* Rafiat's DARS audit (Computer Science BS): completed, in-progress and registered terms. */
export const studentRecord = record as StudentRecord;

/*
 * Allegra's DARS audit (Management Information Systems BBA, Marketing minor, prepared
 * 5 November 2026): four completed terms, Fall 2026 in progress, Spring 2027 registered.
 */
export const misStudentRecord = misRecord as StudentRecord;
