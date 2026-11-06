/*
 * Who is signed in: a profile is a person with a record, and the program that record
 * belongs to. Pure, no React, so the finder model, the plan seed and the server pages
 * all read the same thing.
 *
 * Two profiles: Rafiat (Computer Science BS, her real DARS audit) and Allegra
 * (Management Information Systems BBA, her real DARS audit). Sign-in
 * picks one and the top bar switches between them; the choice is kept in a cookie
 * (see profile-cookie.ts).
 *
 * One profile per program for now, so state that belongs to a program (the shortlist,
 * the four-year board, the finder model) stays keyed by program and existing saved
 * state survives. A second student in one program would need those keyed by profile.
 */
import {
  DEFAULT_PROGRAM,
  misStudentRecord,
  programs,
  studentRecord,
  type ProgramCode,
  type StudentRecord,
} from "@/data";

export type ProfileId = "rafiat" | "allegra";

export type Profile = {
  id: ProfileId;
  /* The top bar's name line. Only what the person gave us: Allegra has no last name on file. */
  name: string;
  /* The mock sign-in's email. Null where none is on file; none is invented. */
  email: string | null;
  program: ProgramCode;
  /* "Computer Science · BS" */
  programLabel: string;
  record: StudentRecord;
};

/* "Computer Science · BS": the program's name and the degree letters its code ends with. */
function programLabel(code: ProgramCode) {
  const letters = code.split("-").at(-1);
  return `${programs[code].degree.program.name} · ${letters}`;
}

function profile(id: ProfileId, name: string, email: string | null, record: StudentRecord): Profile {
  return { id, name, email, program: record.program, programLabel: programLabel(record.program), record };
}

/* Every profile, default first: the sign-in choice and the top bar's menu list them in this order. */
export const PROFILES: readonly Profile[] = [
  profile("rafiat", "Rafiat Amir", "rafiat@temple.edu", studentRecord),
  profile("allegra", "Allegra", null, misStudentRecord),
];

/* Rafiat's. Sign-in starts on it, and anything outside a chosen profile falls back to it. */
export const DEFAULT_PROFILE: ProfileId = "rafiat";

export function isProfileId(value: unknown): value is ProfileId {
  return PROFILES.some((p) => p.id === value);
}

export function profileFor(id: ProfileId = DEFAULT_PROFILE): Profile {
  return PROFILES.find((p) => p.id === id) ?? PROFILES[0];
}

/* The profile whose record a program's state is built from (one per program, see above). */
export function profileForProgram(code: ProgramCode = DEFAULT_PROGRAM): Profile {
  return PROFILES.find((p) => p.program === code) ?? PROFILES[0];
}

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
