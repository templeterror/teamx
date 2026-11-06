"use client";

import { createContext, useContext, type ReactNode } from "react";
import { catalogFor } from "@/components/finder/catalog";
import { DEFAULT_PROFILE, profileFor, type Profile, type ProfileKey } from "./student";

/*
 * The signed-in profile for client components. The server reads the cookies and hands the
 * key down; everything else (record, program, tree, finder model) is derived from @/data.
 * Outside a provider (the /components workbench) it is Rafiat's, as before.
 */
const ProfileContext = createContext<Profile>(profileFor(DEFAULT_PROFILE));

export function StudentProvider({ profile, children }: { profile: ProfileKey; children: ReactNode }) {
  return <ProfileContext value={profileFor(profile)}>{children}</ProfileContext>;
}

export function useProfile() {
  return useContext(ProfileContext);
}

/* The signed-in profile's program: what the requirement tree, plan seed and finder are built from. */
export function useProgram() {
  return useProfile().program;
}

/* The finder model for the signed-in profile, built once per profile (see catalogFor). */
export function useCatalog() {
  return catalogFor(useProfile().key);
}
