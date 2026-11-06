"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_PROGRAM } from "@/data";
import { DEFAULT_PROFILE, profileFor, type ProfileKey } from "@/components/student/student";

/*
 * The Find page's shortlist: an ordered list of course codes, capped at 10.
 * PlanShell holds it next to the plan, so moving between /find and /plan keeps
 * it, and it is mirrored to sessionStorage so a reload of /find keeps it too.
 * Each profile keeps its own, so switching student never carries one student's
 * shortlist into another's plan.
 *
 * It is a trip, not a list that lives on the plan: arriving on /plan hands
 * every shortlisted course to the plan as a suggestion and empties it
 * (see takeAll and week-plan.tsx).
 */

export const SHORTLIST_MAX = 10;

/*
 * Rafiat's keeps the original key and Allegra's the program one it had before profiles,
 * so their shortlists survive. The new student's carries its key, program included:
 * "course-planner:shortlist:new:BU-MIS-BBA".
 */
export function shortlistStorageKey(key: ProfileKey) {
  const { isNew, program } = profileFor(key);
  if (isNew) return `course-planner:shortlist:${key}`;
  return program === DEFAULT_PROGRAM ? "course-planner:shortlist" : `course-planner:shortlist:${program}`;
}
const EMPTY: string[] = [];
/* The server and the hydration pass cannot see sessionStorage; this stands for "not read yet". */
const PENDING: string[] = [];

const cache = new Map<ProfileKey, string[]>();
const listeners = new Set<() => void>();

function read(key: ProfileKey): string[] {
  const cached = cache.get(key);
  if (cached) return cached;
  let list: string[];
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(shortlistStorageKey(key)) ?? "[]");
    list = Array.isArray(parsed)
      ? parsed.filter((c): c is string => typeof c === "string").slice(0, SHORTLIST_MAX)
      : [];
  } catch {
    list = [];
  }
  cache.set(key, list);
  return list;
}

function write(key: ProfileKey, next: string[]) {
  cache.set(key, next);
  try {
    window.sessionStorage.setItem(shortlistStorageKey(key), JSON.stringify(next));
  } catch {
    /* Private mode or storage off: the shortlist still works for this visit. */
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export type Shortlist = {
  codes: readonly string[];
  /* False on the server and during hydration, before sessionStorage is read. */
  ready: boolean;
  count: number;
  full: boolean;
  has: (code: string) => boolean;
  add: (code: string) => void;
  remove: (code: string) => void;
  /* Empties the shortlist and returns what was in it, read fresh rather than from the last render. */
  takeAll: () => string[];
};

/* Empties a profile's shortlist, stored and cached ("+ New student" starts clean). */
export function clearShortlist(key: ProfileKey) {
  cache.set(key, []);
  try {
    window.sessionStorage.removeItem(shortlistStorageKey(key));
  } catch {
    /* Nothing stored to remove. */
  }
  for (const listener of listeners) listener();
}

export function useShortlist(key: ProfileKey = DEFAULT_PROFILE): Shortlist {
  const snapshot = useSyncExternalStore(subscribe, () => read(key), () => PENDING);
  const ready = snapshot !== PENDING;
  const codes = ready ? snapshot : EMPTY;

  const add = useCallback(
    (code: string) => {
      const now = read(key);
      if (now.includes(code) || now.length >= SHORTLIST_MAX) return;
      write(key, [...now, code]);
    },
    [key],
  );
  const remove = useCallback(
    (code: string) => {
      write(key, read(key).filter((c) => c !== code));
    },
    [key],
  );
  const takeAll = useCallback(() => {
    const now = read(key);
    if (now.length) write(key, []);
    return now;
  }, [key]);

  return useMemo(
    () => ({
      codes,
      ready,
      count: codes.length,
      full: codes.length >= SHORTLIST_MAX,
      has: (code: string) => codes.includes(code),
      add,
      remove,
      takeAll,
    }),
    [codes, ready, add, remove, takeAll],
  );
}
