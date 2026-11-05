"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_PROGRAM, type ProgramCode } from "@/data";

/*
 * The Find page's shortlist: an ordered list of course codes, capped at 10.
 * PlanShell holds it next to the plan, so moving between /find and /plan keeps
 * it, and it is mirrored to sessionStorage so a reload of /find keeps it too.
 * Each program keeps its own, so switching student at sign-in never carries
 * one student's shortlist into the other's plan.
 *
 * It is a trip, not a list that lives on the plan: arriving on /plan hands
 * every shortlisted course to the plan as a suggestion and empties it
 * (see takeAll and week-plan.tsx).
 */

export const SHORTLIST_MAX = 10;

/* Rafiat's keeps the original key, so a shortlist from before programs existed survives. */
const keyFor = (program: ProgramCode) =>
  program === DEFAULT_PROGRAM ? "course-planner:shortlist" : `course-planner:shortlist:${program}`;
const EMPTY: string[] = [];
/* The server and the hydration pass cannot see sessionStorage; this stands for "not read yet". */
const PENDING: string[] = [];

const cache = new Map<ProgramCode, string[]>();
const listeners = new Set<() => void>();

function read(program: ProgramCode): string[] {
  const cached = cache.get(program);
  if (cached) return cached;
  let list: string[];
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(keyFor(program)) ?? "[]");
    list = Array.isArray(parsed)
      ? parsed.filter((c): c is string => typeof c === "string").slice(0, SHORTLIST_MAX)
      : [];
  } catch {
    list = [];
  }
  cache.set(program, list);
  return list;
}

function write(program: ProgramCode, next: string[]) {
  cache.set(program, next);
  try {
    window.sessionStorage.setItem(keyFor(program), JSON.stringify(next));
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

export function useShortlist(program: ProgramCode = DEFAULT_PROGRAM): Shortlist {
  const snapshot = useSyncExternalStore(subscribe, () => read(program), () => PENDING);
  const ready = snapshot !== PENDING;
  const codes = ready ? snapshot : EMPTY;

  const add = useCallback(
    (code: string) => {
      const now = read(program);
      if (now.includes(code) || now.length >= SHORTLIST_MAX) return;
      write(program, [...now, code]);
    },
    [program],
  );
  const remove = useCallback(
    (code: string) => {
      write(program, read(program).filter((c) => c !== code));
    },
    [program],
  );
  const takeAll = useCallback(() => {
    const now = read(program);
    if (now.length) write(program, []);
    return now;
  }, [program]);

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
