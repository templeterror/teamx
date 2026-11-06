import { cookies } from "next/headers";
import { DEFAULT_PROGRAM, isProgramCode, type ProgramCode } from "@/data";
import {
  DEFAULT_PROFILE,
  PROFILES,
  isNewStudentProgram,
  isProfileId,
  profileKey,
  type ProfileId,
  type ProfileKey,
} from "./student";

/*
 * The signed-in profile lives in a cookie, not in storage, so the server renders that
 * person from the first byte: no Rafiat-then-Allegra flash and no hydration mismatch.
 * Server only (next/headers). With Cache Components, a caller must sit inside <Suspense>.
 */
export const PROFILE_COOKIE = "course-planner-profile";

/*
 * The new student's program, next to the profile cookie so server components can read it:
 * "ST-CSCI-BS" or "BU-MIS-BBA", chosen in plan setup. Only the new student reads it.
 */
export const NEW_PROGRAM_COOKIE = "course-planner-new-program";

/*
 * Before profiles, sign-in kept a program code here. A browser that still has only this
 * cookie resolves to the profile with a record in that program; the next choice replaces it (see actions.ts).
 */
export const LEGACY_PROGRAM_COOKIE = "course-planner-program";

/* Who is signed in; Rafiat when nothing (or something unknown) was chosen. */
export async function currentProfileId(): Promise<ProfileId> {
  const jar = await cookies();
  const id = jar.get(PROFILE_COOKIE)?.value;
  if (isProfileId(id)) return id;
  const legacy = jar.get(LEGACY_PROGRAM_COOKIE)?.value;
  return (isProgramCode(legacy) && PROFILES.find((p) => p.program === legacy)?.id) || DEFAULT_PROFILE;
}

/* The new student's chosen program; Computer Science until one is chosen. */
export async function newStudentProgram(): Promise<ProgramCode> {
  const program = (await cookies()).get(NEW_PROGRAM_COOKIE)?.value;
  return isNewStudentProgram(program) ? program : DEFAULT_PROGRAM;
}

/* The signed-in profile's key: its id, or "new:<program>" for the new student. */
export async function currentProfile(): Promise<ProfileKey> {
  const id = await currentProfileId();
  return profileKey(id, id === "new" ? await newStudentProgram() : undefined);
}
