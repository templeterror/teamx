/*
 * The student's own edits to the four-year board, one store per profile and program:
 * the cards they moved (to a term or the tray) and the course they picked for a card.
 * Everything else is autoPlace (board.ts), so changing preferences re-flows the rest.
 *
 * v3: the board is built from the audit's open slots now; v2 boards held the bulletin's
 * sample-plan cards and mean nothing here.
 */
import { useSyncExternalStore } from "react";
import type { ProgramCode } from "@/data";
import type { ProfileId } from "@/components/student/student";
import type { Choices, Moves } from "./board";

export type Edits = { moves: Moves; choices: Choices };

const NONE: Edits = { moves: {}, choices: {} };

export const EDITS_KEY = (profile: ProfileId, program: ProgramCode) => `course-planner:four-year:v3:${profile}:${program}`;

type Store = {
  read: () => Edits;
  save: (edits: Edits) => void;
  subscribe: (listener: () => void) => () => void;
};
const STORES = new Map<string, Store>();

function strings(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

function storeFor(key: string): Store {
  const existing = STORES.get(key);
  if (existing) return existing;
  let cache: Edits | undefined;
  const listeners = new Set<() => void>();

  function read() {
    if (cache) return cache;
    try {
      const saved = JSON.parse(window.localStorage.getItem(key) ?? "null") as Partial<Edits> | null;
      cache = saved ? { moves: strings(saved.moves), choices: strings(saved.choices) } : NONE;
    } catch {
      cache = NONE;
    }
    return cache;
  }

  function save(edits: Edits) {
    cache = edits;
    try {
      window.localStorage.setItem(key, JSON.stringify(edits));
    } catch {
      /* Keep edits in memory if browser storage is disabled. */
    }
    for (const listener of listeners) listener();
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
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

  const store = { read, save, subscribe };
  STORES.set(key, store);
  return store;
}

export function useEdits(profile: ProfileId, program: ProgramCode) {
  const store = storeFor(EDITS_KEY(profile, program));
  const edits = useSyncExternalStore(store.subscribe, store.read, () => NONE);
  return {
    edits,
    move: (id: string, term: string) => {
      const current = store.read();
      store.save({ ...current, moves: { ...current.moves, [id]: term } });
    },
    choose: (id: string, code: string) => {
      const current = store.read();
      store.save({ ...current, choices: { ...current.choices, [id]: code } });
    },
    /* "Re-place remaining courses": autoPlace again, keeping the courses the student picked. */
    clearMoves: () => store.save({ ...store.read(), moves: {} }),
  };
}
