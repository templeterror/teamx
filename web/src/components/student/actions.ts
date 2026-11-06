"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEFAULT_PROFILE, isProfileId, type ProfileId } from "./student";
import { LEGACY_PROGRAM_COOKIE, PROFILE_COOKIE } from "./profile-cookie";

/* Keep the profile for a year, and drop the program cookie it replaces. */
async function remember(id: ProfileId) {
  const jar = await cookies();
  jar.set(PROFILE_COOKIE, id, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  jar.delete(LEGACY_PROGRAM_COOKIE);
}

/*
 * Sign-in's Continue: keep the chosen profile, then plan setup (/onboarding), which
 * confirms what the record says, asks the rest, and ends on the four-year plan.
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
