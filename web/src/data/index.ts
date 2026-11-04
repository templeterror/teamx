import academicPlan from "./academic-plan.json";
import courseCatalog from "./courses.json";
import program from "./program.json";
import sectionCatalog from "./sections.json";
import record from "./student-record.json";

export const bulletinYear = "2026-2027" as const;
export const courses = courseCatalog.courses;
export const degree = program;
export const suggestedPlan = academicPlan;
export const sections = sectionCatalog.sections;

export type CourseCode = keyof typeof courses;

export type RecordStatus = "completed" | "in-progress" | "registered";
export type RecordCourse = { code: string; title: string; credits: number };
export type RecordTerm = { term: string; status: RecordStatus; courses: RecordCourse[] };
export type StudentRecord = Omit<typeof record, "terms"> & { terms: RecordTerm[] };

/* The demo student's DARS audit: completed, in-progress and registered terms. */
export const studentRecord = record as StudentRecord;
