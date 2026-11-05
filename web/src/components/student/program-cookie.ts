import { cookies } from "next/headers";
import { DEFAULT_PROGRAM, isProgramCode, type ProgramCode } from "@/data";

/*
 * The sign-in program choice lives in a cookie, not in storage, so the server renders
 * the chosen student from the first byte: no Rafiat-then-new-student flash and no
 * hydration mismatch. Server only (next/headers). With Cache Components, a caller must
 * sit inside <Suspense>.
 */
export const PROGRAM_COOKIE = "course-planner-program";

/* The signed-in student's program; Rafiat's when nothing (or something unknown) was chosen. */
export async function currentProgram(): Promise<ProgramCode> {
  const value = (await cookies()).get(PROGRAM_COOKIE)?.value;
  return isProgramCode(value) ? value : DEFAULT_PROGRAM;
}
