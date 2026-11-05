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
export type RecordCourse = { code: string; title: string; credits: number };
export type RecordTerm = { term: string; status: RecordStatus; courses: RecordCourse[] };
/*
 * The shape both records share. Rafiat's also carries the audit's numbers and open items;
 * a new student has none, so they stay out of the type rather than being made up.
 */
export type StudentRecord = {
  source: string;
  student: string | null;
  program: ProgramCode;
  catalogYear: string | null;
  minor: string | null;
  terms: RecordTerm[];
  satisfiedByException: { requirement: string; note: string }[];
};

/* The demo student's DARS audit: completed, in-progress and registered terms. */
export const studentRecord = record as StudentRecord;

/* A new Management Information Systems BBA student: nothing taken, nothing registered. */
export const misStudentRecord = misRecord as StudentRecord;
