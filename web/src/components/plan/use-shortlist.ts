"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/*
 * The Find page's shortlist: an ordered list of course codes, capped at 10.
 * PlanShell holds it next to the plan, so moving between /find and /plan keeps
 * it, and it is mirrored to sessionStorage so a reload of /find keeps it too.
 *
 * It is a trip, not a list that lives on the plan: arriving on /plan hands
 * every shortlisted course to the plan as a suggestion and empties it
 * (see takeAll and week-plan.tsx).
 */

export const SHORTLIST_MAX = 10;

const KEY = "course-planner:shortlist";
const EMPTY: string[] = [];
/* The server and the hydration pass cannot see sessionStorage; this stands for "not read yet". */
const PENDING: string[] = [];

let cache: string[] | null = null;
const listeners = new Set<() => void>();

function read(): string[] {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(parsed)
      ? parsed.filter((c): c is string => typeof c === "string").slice(0, SHORTLIST_MAX)
      : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: string[]) {
  cache = next;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
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

export function useShortlist(): Shortlist {
  const snapshot = useSyncExternalStore(subscribe, read, () => PENDING);
  const ready = snapshot !== PENDING;
  const codes = ready ? snapshot : EMPTY;

  const add = useCallback((code: string) => {
    const now = read();
    if (now.includes(code) || now.length >= SHORTLIST_MAX) return;
    write([...now, code]);
  }, []);
  const remove = useCallback((code: string) => {
    write(read().filter((c) => c !== code));
  }, []);
  const takeAll = useCallback(() => {
    const now = read();
    if (now.length) write([]);
    return now;
  }, []);

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
