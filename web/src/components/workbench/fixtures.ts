"use client";

/*
 * Fixed plan states for the workbench. Each state starts from a known plan
 * and stays interactive (drop, add, swap, take it later), so a state can be
 * poked at without losing the others.
 */

import { useState } from "react";
import {
  agi,
  college,
  dataScience,
  databases,
  os,
  society,
  webApps,
  writing,
  type Offering,
} from "@/components/plan/data";
import type { Placement } from "@/components/plan/use-plan";
import type { PairPlan } from "@/components/schedule-pair/schedule-pair";

type Seed = Pick<Placement, "id" | "kind" | "course" | "dotted" | "options"> & {
  deferred?: boolean;
  canDefer?: boolean;
};

/* CIS 4331 section 001 in sections.json meets MWF 10:00–11:05, on top of CIS 3207. */
const databasesMorning: Offering = {
  ...databases,
  days: ["Mon", "Wed", "Fri"],
  start: 10 * 60,
  end: 11 * 60 + 5,
};

const starting: Seed[] = [
  { id: "os", kind: "core", course: os, dotted: false, options: [] },
  { id: "writing", kind: "core", course: writing, dotted: false, options: [], canDefer: true },
  { id: "a", kind: "elective", course: databases, dotted: true, options: [databases, dataScience] },
  { id: "b", kind: "elective", course: agi, dotted: true, options: [agi, webApps] },
  { id: "gen", kind: "gened", course: college, dotted: true, options: [college, society] },
];

type State = {
  id: string;
  name: string;
  note: string;
  seeds: Seed[];
  expanded?: string;
  confirmed?: string[] | "all";
  preview?: { itemId: string; code: string };
};

export const STATES: State[] = [
  {
    id: "first-open",
    name: "First open",
    note: "Nothing decided yet. Every course is a suggestion until the student confirms it.",
    seeds: starting,
  },
  {
    id: "course-open",
    name: "Course open",
    note: "A course page open: Databases' description, prerequisites, what it is a prerequisite for, and its alternative, with its meetings ringed in the week.",
    seeds: starting,
    expanded: "a",
  },
  {
    id: "confirmed",
    name: "Plan confirmed",
    note: "After Confirm plan. Every course can still be swapped, added, or dropped.",
    seeds: starting,
    confirmed: "all",
  },
  {
    id: "previewing",
    name: "Previewing a swap",
    note: "On the Databases page, Data Science pinned as a preview: Databases fades out in the week, Data Science outlined in its place. Nothing changes until Swap.",
    seeds: starting,
    confirmed: "all",
    expanded: "a",
    preview: { itemId: "a", code: "CIS 3715" },
  },
  {
    id: "conflict",
    name: "Time conflict",
    note: "Section 001 of CIS 4331 overlaps CIS 3207 on Mon, Wed, Fri.",
    seeds: starting.map((s) =>
      s.id === "a" ? { ...s, course: databasesMorning, options: [databasesMorning, dataScience] } : s,
    ),
    expanded: "a",
  },
  {
    id: "deferred",
    name: "Course moved later",
    note: "Software Design moved to a later term: its card stays, dimmed, with Add. A third elective is suggested for the open slot.",
    seeds: [
      ...starting.map((s) => (s.id === "writing" ? { ...s, deferred: true } : s)),
      { id: "c", kind: "elective", course: dataScience, dotted: true, options: [dataScience, webApps, databases] },
    ],
  },
];


function overlaps(a: Offering, b: Offering) {
  return a.days.some((d) => b.days.includes(d)) && a.start < b.end && b.start < a.end;
}

export function useFixture(seeds: readonly Seed[]): PairPlan {
  const [chosen, setChosen] = useState<Record<string, Offering>>({});
  const [off, setOff] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(seeds.map((s) => [s.id, Boolean(s.deferred)])),
  );
  /* Off because of Drop, as opposed to moved to a later term. */
  const [dropped, setDropped] = useState<Record<string, boolean>>({});

  const placements: Placement[] = seeds.map((s) => ({
    id: s.id,
    kind: s.kind,
    course: chosen[s.id] ?? s.course,
    dotted: s.dotted,
    options: s.options,
    deferred: off[s.id],
    dropped: off[s.id] && dropped[s.id],
    pick: (code) => {
      const next = s.options.find((o) => o.code === code);
      if (next) setChosen((c) => ({ ...c, [s.id]: next }));
    },
    defer: s.canDefer ? () => setOff((o) => ({ ...o, [s.id]: true })) : undefined,
    restore: s.canDefer ? () => setOff((o) => ({ ...o, [s.id]: false })) : undefined,
  }));

  const active = placements.filter((p) => !p.deferred);
  const credits = active.reduce((sum, p) => sum + p.course.credits, 0);

  return {
    placements,
    credits,
    conflictsFor: (id) => {
      const me = active.find((p) => p.id === id);
      return me ? active.filter((p) => p.id !== id && overlaps(p.course, me.course)) : [];
    },
    toggleCourse: (item) => {
      setOff((o) => ({ ...o, [item.id]: !o[item.id] }));
      setDropped((d) => ({ ...d, [item.id]: !item.deferred }));
    },
  };
}
