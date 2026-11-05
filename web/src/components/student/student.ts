/*
 * Who is signed in: a record plus the program it belongs to. Pure, no React, so the
 * finder model, the plan seed and the server pages all read the same thing.
 *
 * Two students: Rafiat (Computer Science BS, her real DARS audit) and a new
 * Management Information Systems BBA student with an empty record. The choice is
 * made on the sign-in page and kept in a cookie (see program-cookie.ts).
 */
import {
  DEFAULT_PROGRAM,
  misStudentRecord,
  programs,
  studentRecord,
  type ProgramCode,
  type StudentRecord,
} from "@/data";

export type Student = {
  program: ProgramCode;
  /* The top bar's name line. A new student has no name in the record, and none is invented. */
  name: string;
  /* "Computer Science · BS" */
  programLabel: string;
  /* What the sign-in choice says about the record behind it. */
  recordNote: string;
  record: StudentRecord;
  /*
   * Top-level requirement nodes whose named courses read "Required" in the finder.
   * The tree cannot say this on its own: the CS college node is only a first-year
   * seminar choice and was never shown as Required, while the Fox foundation is twenty
   * named business courses every BBA student takes.
   */
  requiredFrom: string[];
};

const STUDENTS: Record<ProgramCode, Omit<Student, "program" | "programLabel">> = {
  "ST-CSCI-BS": {
    name: "Rafiat Amir",
    recordNote: "Rafiat’s degree audit",
    record: studentRecord,
    requiredFrom: ["major"],
  },
  "BU-MIS-BBA": {
    name: "New student",
    recordNote: "New student",
    record: misStudentRecord,
    requiredFrom: ["fox", "major"],
  },
};

/* "Computer Science · BS": the program's name and the degree letters its code ends with. */
function programLabel(code: ProgramCode) {
  const letters = code.split("-").at(-1);
  return `${programs[code].degree.program.name} · ${letters}`;
}

export function studentFor(code: ProgramCode = DEFAULT_PROGRAM): Student {
  return { program: code, programLabel: programLabel(code), ...STUDENTS[code] };
}

/* Every student, default first, for the sign-in choice. */
export const STUDENT_CHOICES: Student[] = (Object.keys(STUDENTS) as ProgramCode[])
  .sort((a, b) => Number(b === DEFAULT_PROGRAM) - Number(a === DEFAULT_PROGRAM))
  .map((code) => studentFor(code));
