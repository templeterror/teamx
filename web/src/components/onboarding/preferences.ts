/*
 * What onboarding asks for, kept per profile in localStorage: when the student wants to
 * finish, how many credits a term, whether summers count, and which minor; for the new
 * student also the term they start. Everything else comes from the record. The four-year
 * board reads this with usePreferences.
 *
 * Same store pattern as the four-year board: one store per profile, a cached snapshot so
 * useSyncExternalStore sees the same object until something is saved, and the profile's
 * defaults on the server (and wherever storage is unavailable).
 */
import { useSyncExternalStore } from "react";
import { CURRENT_TERM } from "@/components/plan/terms";
import { graduationProgress } from "@/components/progress/progress";
import { profileFor, type ProfileKey } from "@/components/student/student";
import { nextFall, nextRegularTerm, parseTerm, shiftRegularTerm, termLabel, type Term } from "./terms";

export type PlanPreferences = {
  completedAt: string | null;  // ISO timestamp when onboarding finished; null = not onboarded
  startTerm: string | null;    // the new student's first term ("Spring 2027"); null for a profile with a record
  graduationTerm: string;      // e.g. "Spring 2028"
  creditsPerTerm: number;      // target load for future terms, 12–18
  summers: boolean;            // whether summer terms may hold courses
  minor: string | null;        // e.g. "Marketing"
};

/*
 * "course-planner:preferences:v1:rafiat" and ":allegra" as before; the new student's
 * carries the program, "course-planner:preferences:v1:new:BU-MIS-BBA".
 */
export const PREFERENCES_KEY = (profile: ProfileKey) => `course-planner:preferences:v1:${profile}`;

const MIN_CREDITS = 12;
const MAX_CREDITS = 18;
const DEFAULT_CREDITS = 15;
/* Fall and spring terms in four years. */
const FOUR_YEARS = 8;

/*
 * The terms a new student may start in: the term the app plans now (the top bar's
 * Spring 2027) and the fall after it.
 */
const current = parseTerm(CURRENT_TERM)!;
export const START_TERMS: readonly string[] = [CURRENT_TERM, termLabel(nextRegularTerm(current))];

/* The first fall or spring term on the record, or the next fall when there is none. */
function recordStart(profile: ProfileKey): Term {
  for (const entry of profileFor(profile).record.terms) {
    const term = parseTerm(entry.term);
    if (term && term.season !== "Summer") return term;
  }
  return nextFall(new Date());
}

/* The eighth fall/spring term counting the first: Fall 2024 → Spring 2028, Spring 2027 → Fall 2030. */
export function fourYearsFrom(start: string): string {
  const term = parseTerm(start) ?? current;
  return termLabel(shiftRegularTerm(term, FOUR_YEARS - 1));
}

/*
 * A new student's default load: 15 a term, or the lightest load that fits every credit
 * into four years when 15 does not (123 credits over 8 terms needs 16), so the default
 * plan passes the pace check instead of opening on a warning.
 */
function newStudentCredits(profile: ProfileKey): number {
  const { program, record } = profileFor(profile);
  const required = graduationProgress(program, record, []).totalCredits.required;
  return Math.min(MAX_CREDITS, Math.max(DEFAULT_CREDITS, Math.ceil(required / FOUR_YEARS)));
}

const DEFAULTS = new Map<ProfileKey, PlanPreferences>();

/*
 * The profile's defaults: the record's minor, the eighth fall/spring term counting the
 * first (Allegra: Fall 2024 → Spring 2028), 15 credits, no summers, not onboarded.
 * A new student starts in the term being planned now (Spring 2027 → Fall 2030), with no minor.
 * Cached, so it is a stable server snapshot.
 */
export function defaultPreferences(profile: ProfileKey): PlanPreferences {
  const cached = DEFAULTS.get(profile);
  if (cached) return cached;
  const { isNew, record } = profileFor(profile);
  const start = isNew ? CURRENT_TERM : null;
  const prefs: PlanPreferences = {
    completedAt: null,
    startTerm: start,
    graduationTerm: fourYearsFrom(start ?? termLabel(recordStart(profile))),
    creditsPerTerm: isNew ? newStudentCredits(profile) : DEFAULT_CREDITS,
    summers: false,
    minor: record.minor,
  };
  DEFAULTS.set(profile, prefs);
  return prefs;
}

/* Whatever was saved, checked field by field; anything missing or malformed falls back to the default. */
function readSaved(value: unknown, fallback: PlanPreferences): PlanPreferences {
  if (!value || typeof value !== "object") return fallback;
  const saved = value as Partial<Record<keyof PlanPreferences, unknown>>;
  const credits = typeof saved.creditsPerTerm === "number" && Number.isFinite(saved.creditsPerTerm)
    ? Math.min(MAX_CREDITS, Math.max(MIN_CREDITS, Math.round(saved.creditsPerTerm)))
    : fallback.creditsPerTerm;
  return {
    completedAt: typeof saved.completedAt === "string" ? saved.completedAt : fallback.completedAt,
    /* Only the new student has a start term to choose; a record profile's stays null. */
    startTerm:
      fallback.startTerm !== null && typeof saved.startTerm === "string" && START_TERMS.includes(saved.startTerm)
        ? saved.startTerm
        : fallback.startTerm,
    graduationTerm:
      typeof saved.graduationTerm === "string" && parseTerm(saved.graduationTerm)
        ? saved.graduationTerm
        : fallback.graduationTerm,
    creditsPerTerm: credits,
    summers: typeof saved.summers === "boolean" ? saved.summers : fallback.summers,
    minor: saved.minor === null || typeof saved.minor === "string" ? (saved.minor as string | null) : fallback.minor,
  };
}

type PreferencesStore = {
  read: () => PlanPreferences;
  save: (prefs: PlanPreferences) => void;
  reset: () => void;
  subscribe: (listener: () => void) => () => void;
};
const STORES = new Map<ProfileKey, PreferencesStore>();

function storeFor(profile: ProfileKey): PreferencesStore {
  const existing = STORES.get(profile);
  if (existing) return existing;

  const key = PREFERENCES_KEY(profile);
  let cache: PlanPreferences | undefined;
  const listeners = new Set<() => void>();

  function notify() {
    for (const listener of listeners) listener();
  }

  function read() {
    if (cache) return cache;
    try {
      cache = readSaved(JSON.parse(window.localStorage.getItem(key) ?? "null"), defaultPreferences(profile));
    } catch {
      cache = defaultPreferences(profile);
    }
    return cache;
  }

  function save(prefs: PlanPreferences) {
    cache = readSaved(prefs, defaultPreferences(profile));
    try {
      window.localStorage.setItem(key, JSON.stringify(cache));
    } catch {
      /* Keep the choice in memory if browser storage is disabled. */
    }
    notify();
  }

  function reset() {
    cache = defaultPreferences(profile);
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* Nothing stored to remove. */
    }
    notify();
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    /* Another tab saved or reset: drop the cache so the next read sees it. */
    function onStorage(event: StorageEvent) {
      if (event.key !== null && event.key !== key) return;
      cache = undefined;
      listener();
    }
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  const store = { read, save, reset, subscribe };
  STORES.set(profile, store);
  return store;
}

export function usePreferences(profile: ProfileKey): PlanPreferences {
  const store = storeFor(profile);
  return useSyncExternalStore(store.subscribe, store.read, () => defaultPreferences(profile));
}

export function savePreferences(profile: ProfileKey, prefs: PlanPreferences): void {
  storeFor(profile).save(prefs);
}

export function resetPreferences(profile: ProfileKey): void {
  storeFor(profile).reset();
}
