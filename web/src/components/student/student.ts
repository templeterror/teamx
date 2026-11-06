/*
 * Who is signed in: a profile is a person with a record, and the program that record
 * belongs to. Pure, no React, so the finder model, the plan seed and the server pages
 * all read the same thing.
 *
 * Three profiles: Rafiat (Computer Science BS, her real DARS audit), Allegra
 * (Management Information Systems BBA, her real DARS audit), and a new student with no
 * record yet, whose program is their own choice (CS or MIS). Sign-in picks one and the
 * top bar switches between them; the choice is kept in cookies (see profile-cookie.ts).
 *
 * A profile's `key` names its saved state. Rafiat's and Allegra's are their ids, so the
 * state they saved before the new student existed survives. The new student's carries
 * the program too ("new:BU-MIS-BBA"): two programs are two students, so switching major
 * starts that major clean, and neither ever reads Rafiat's or Allegra's state.
 */
import {
  DEFAULT_PROGRAM,
  bulletinYear,
  misStudentRecord,
  programs,
  studentRecord,
  type DarsAudit,
  type ProgramCode,
  type StudentRecord,
} from "@/data";

/* What the profile cookie holds: who, not which program. */
export type ProfileId = "rafiat" | "allegra" | "new";

/* One per record: Rafiat's, Allegra's, and the new student's in each program. Names saved state. */
export type ProfileKey = "rafiat" | "allegra" | `new:${ProgramCode}`;

export type Profile = {
  id: ProfileId;
  key: ProfileKey;
  /* No record yet: no terms, no audit, a program of their own choosing. */
  isNew: boolean;
  /* The top bar's name line. Only what the person gave us: Allegra has no last name on file. */
  name: string;
  /* The mock sign-in's email. Null where none is on file; none is invented. */
  email: string | null;
  program: ProgramCode;
  /* "Computer Science · BS" */
  programLabel: string;
  record: StudentRecord;
  /* The record's DARS audit, requirement by requirement; null for the new student. */
  dars: DarsAudit | null;
};

/* "Computer Science · BS": the program's name and the degree letters its code ends with. */
function programLabel(code: ProgramCode) {
  const letters = code.split("-").at(-1);
  return `${programs[code].degree.program.name} · ${letters}`;
}

function profile(id: "rafiat" | "allegra", name: string, email: string | null, record: StudentRecord): Profile {
  return { id, key: id, isNew: false, name, email, program: record.program, programLabel: programLabel(record.program), record, dars: record.dars ?? null };
}

/* The people with a record, default first: sign-in and the top bar's menu list them in this order, then the new student. */
export const PROFILES: readonly Profile[] = [
  profile("rafiat", "Rafiat Amir", "rafiat@temple.edu", studentRecord),
  profile("allegra", "Allegra", null, misStudentRecord),
];

export const NEW_STUDENT_NAME = "New student";

/* The programs a new student can choose: the two the catalog has data for, CS first (the default). */
export const NEW_STUDENT_PROGRAMS: readonly ProgramCode[] = ["ST-CSCI-BS", "BU-MIS-BBA"];

/*
 * A new student's record, built here rather than read from a file: the chosen program,
 * the catalog year of the bulletin the data comes from (2026-2027, so Fall 2026, in the
 * records' "Fall 2025" form), and nothing else. No terms, no audit, no exceptions, no minor.
 */
function newStudentRecord(program: ProgramCode): StudentRecord {
  return {
    source: `No degree audit yet: a new student in the ${bulletinYear} bulletin, before their first term.`,
    student: null,
    program,
    catalogYear: `Fall ${bulletinYear.slice(0, 4)}`,
    minor: null,
    terms: [],
    satisfiedByException: [],
  };
}

const NEW_STUDENTS = new Map<ProgramCode, Profile>(
  NEW_STUDENT_PROGRAMS.map((program) => [
    program,
    {
      id: "new",
      key: `new:${program}`,
      isNew: true,
      name: NEW_STUDENT_NAME,
      email: null,
      program,
      programLabel: programLabel(program),
      record: newStudentRecord(program),
      dars: null,
    },
  ]),
);

/* Rafiat's. Sign-in starts on it, and anything outside a chosen profile falls back to it. */
export const DEFAULT_PROFILE = "rafiat" satisfies ProfileId & ProfileKey;

export function isProfileId(value: unknown): value is ProfileId {
  return value === "new" || PROFILES.some((p) => p.id === value);
}

export function isNewStudentProgram(value: unknown): value is ProgramCode {
  return NEW_STUDENT_PROGRAMS.some((code) => code === value);
}

/* The key for a profile id; the new student's needs its program (CS when none was chosen). */
export function profileKey(id: ProfileId, program: ProgramCode = DEFAULT_PROGRAM): ProfileKey {
  return id === "new" ? `new:${isNewStudentProgram(program) ? program : DEFAULT_PROGRAM}` : id;
}

export function profileFor(key: ProfileKey = DEFAULT_PROFILE): Profile {
  if (key.startsWith("new:")) return NEW_STUDENTS.get(key.slice(4) as ProgramCode) ?? NEW_STUDENTS.get(DEFAULT_PROGRAM)!;
  return PROFILES.find((p) => p.key === key) ?? PROFILES[0];
}

/* Every key, for anything that walks all saved state (the term pages' static params). */
export const PROFILE_KEYS: readonly ProfileKey[] = [...PROFILES.map((p) => p.key), ...[...NEW_STUDENTS.values()].map((p) => p.key)];

/*
 * Top-level requirement nodes whose named courses read "Required" in the finder. A fact
 * about the program, not the person. The tree cannot say this on its own: the CS college
 * node is only a first-year seminar choice and was never shown as Required, while the
 * Fox foundation is twenty named business courses every BBA student takes.
 */
export const REQUIRED_FROM: Record<ProgramCode, string[]> = {
  "ST-CSCI-BS": ["major"],
  "BU-MIS-BBA": ["fox", "major"],
};
