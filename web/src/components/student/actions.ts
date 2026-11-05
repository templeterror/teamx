"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEFAULT_PROGRAM, isProgramCode } from "@/data";
import { PROGRAM_COOKIE } from "./program-cookie";

/* Sign-in's Continue: keep the chosen program for a year, then pick a term. */
export async function chooseProgram(form: FormData) {
  const value = form.get("program");
  (await cookies()).set(PROGRAM_COOKIE, isProgramCode(value) ? value : DEFAULT_PROGRAM, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/term");
}
