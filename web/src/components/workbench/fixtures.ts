"use client";

/*
 * Fixed plan states for the workbench. Each state starts from a known plan
 * and stays interactive (drop, add, swap, take it later), so a state can be
 * poked at without losing the others.
 */

import { useState } from "react";
import {
  automata,
  compilers,
  constitution,
  dataIntensive,
  dataScience,
  machineLearning,
  meaningOfArts,
  microservices,
  offeringFor,
  sacredSpace,
  seminar,
  shakespeareMovies,
  socialMovements,
  softwareDesign,
  webApps,
  whyCollege,
  type Offering,
} from "@/components/plan/data";
import type { Placement } from "@/components/plan/use-plan";
import type { PairPlan } from "@/components/schedule-pair/schedule-pair";

type Seed = Pick<Placement, "id" | "kind" | "course" | "dotted" | "options"> & {
  deferred?: boolean;
  canDefer?: boolean;
};

/* CIS 3217 section 001 in sections.json meets MWF 12:00–12:50, on top of CIS 4360. */
const architecture = offeringFor("CIS 3217", "Major elective. Prerequisites met.");

const starting: Seed[] = [
  { id: "software-design", kind: "core", course: softwareDesign, dotted: false, options: [], canDefer: true },
  { id: "a", kind: "elective", course: machineLearning, dotted: true, options: [machineLearning, dataScience, dataIntensive] },
  { id: "b", kind: "elective", course: seminar, dotted: true, options: [seminar, microservices, compilers] },
  { id: "arts", kind: "gened", course: meaningOfArts, dotted: true, options: [meaningOfArts, sacredSpace, shakespeareMovies] },
  { id: "us-society", kind: "gened", course: whyCollege, dotted: true, options: [whyCollege, socialMovements, constitution] },
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
    note: "A course page open: Machine Learning's description, prerequisites, what it is a prerequisite for, and its alternatives, with its meetings ringed in the week.",
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
    note: "On the Machine Learning page, Data Science pinned as a preview: Machine Learning fades out in the week, Data Science outlined in its place. Nothing changes until Swap.",
    seeds: starting,
    confirmed: "all",
    expanded: "a",
    preview: { itemId: "a", code: "CIS 3715" },
  },
  {
    id: "conflict",
    name: "Time conflict",
    note: "Section 001 of CIS 3217 overlaps CIS 4360 on Mon, Wed, Fri.",
    seeds: starting.map((s) =>
      s.id === "a" ? { ...s, course: architecture, options: [architecture, machineLearning] } : s,
    ),
    expanded: "a",
  },
  {
    id: "deferred",
    name: "Course moved later",
    note: "Software Design moved to a later term: its card stays, dimmed, with Add. A third elective is suggested for the open slot.",
    seeds: [
      ...starting.map((s) => (s.id === "software-design" ? { ...s, deferred: true } : s)),
      { id: "c", kind: "elective", course: webApps, dotted: true, options: [webApps, automata] },
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
