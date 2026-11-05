import { cookies } from "next/headers";
import { isProgramCode, type ProgramCode } from "@/data";
import { DEFAULT_PROFILE, isProfileId, profileFor, profileForProgram, type ProfileId } from "./student";

/*
 * The signed-in profile lives in a cookie, not in storage, so the server renders that
 * person from the first byte: no Rafiat-then-Allegra flash and no hydration mismatch.
 * Server only (next/headers). With Cache Components, a caller must sit inside <Suspense>.
 */
export const PROFILE_COOKIE = "course-planner-profile";

/*
 * Before profiles, sign-in kept a program code here. A browser that still has only this
 * cookie resolves to that program's profile; the next choice replaces it (see actions.ts).
 */
export const LEGACY_PROGRAM_COOKIE = "course-planner-program";

/* The signed-in profile; Rafiat's when nothing (or something unknown) was chosen. */
export async function currentProfile(): Promise<ProfileId> {
  const jar = await cookies();
  const id = jar.get(PROFILE_COOKIE)?.value;
  if (isProfileId(id)) return id;
  const legacy = jar.get(LEGACY_PROGRAM_COOKIE)?.value;
  return isProgramCode(legacy) ? profileForProgram(legacy).id : DEFAULT_PROFILE;
}

/* The signed-in profile's program, for pages that only need the record's program. */
export async function currentProgram(): Promise<ProgramCode> {
  return profileFor(await currentProfile()).program;
}
