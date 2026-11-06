"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEFAULT_PROGRAM, type ProgramCode } from "@/data";
import { DEFAULT_PROFILE, isNewStudentProgram, isProfileId, type ProfileId } from "./student";
import { LEGACY_PROGRAM_COOKIE, NEW_PROGRAM_COOKIE, PROFILE_COOKIE } from "./profile-cookie";

const YEAR = 60 * 60 * 24 * 365;

/* Keep the profile for a year, and drop the program cookie it replaces. */
async function remember(id: ProfileId) {
  const jar = await cookies();
  jar.set(PROFILE_COOKIE, id, { path: "/", sameSite: "lax", maxAge: YEAR });
  jar.delete(LEGACY_PROGRAM_COOKIE);
}

async function rememberNewProgram(program: ProgramCode) {
  const jar = await cookies();
  jar.set(NEW_PROGRAM_COOKIE, program, { path: "/", sameSite: "lax", maxAge: YEAR });
}

/*
 * Sign-in's Continue: keep the chosen profile, then plan setup (/onboarding), which
 * confirms what the record says, asks the rest, and ends on the four-year plan. The new
 * student picks their program there.
 */
export async function chooseProfile(form: FormData) {
  const value = form.get("profile");
  await remember(isProfileId(value) ? value : DEFAULT_PROFILE);
  redirect("/onboarding");
}

/*
 * The top bar's switcher. No redirect: setting a cookie in a Server Action re-renders
 * the current page and its layouts on the server, so the page the person is on comes
 * back as the other profile's, in place. Every workspace route exists for every
 * profile; old terms (/term/[slug]) are per profile but have no top bar to switch from.
 */
export async function switchProfile(id: ProfileId) {
  if (!isProfileId(id)) return;
  await remember(id);
}

/*
 * The switcher's "+ New student": a new student from scratch, in the default program.
 * The client has already cleared that profile's saved state (see new-student.ts); this
 * sets the cookies and opens plan setup.
 */
export async function startNewStudent() {
  await remember("new");
  await rememberNewProgram(DEFAULT_PROGRAM);
  redirect("/onboarding");
}

/* Plan setup's program choice for the new student. Re-renders the page in place, like switchProfile. */
export async function chooseNewStudentProgram(program: ProgramCode) {
  if (!isNewStudentProgram(program)) return;
  await rememberNewProgram(program);
}
