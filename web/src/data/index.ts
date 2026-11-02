import academicPlan from "./academic-plan.json";
import courseCatalog from "./courses.json";
import program from "./program.json";
import sectionCatalog from "./sections.json";

export const bulletinYear = "2026-2027" as const;
export const courses = courseCatalog.courses;
export const degree = program;
export const suggestedPlan = academicPlan;
export const sections = sectionCatalog.sections;

export type CourseCode = keyof typeof courses;
