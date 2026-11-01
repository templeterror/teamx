"use client";

import { useState } from "react";
import {
  CREDIT_MAX,
  agi,
  college,
  dataScience,
  databases,
  os,
  society,
  webApps,
  writing,
  type Offering,
} from "./data";

export type Placement = {
  id: string;
  kind: "core" | "elective" | "gened" | "free-elective";
  course: Offering;
  dotted: boolean;
  options: Offering[];
  pick: (code: string) => void;
  deferred?: boolean;
  defer?: () => void;
  restore?: () => void;
};

function overlaps(a: Offering, b: Offering) {
  if (!a.days.some((day) => b.days.includes(day))) return false;
  return a.start < b.end && b.start < a.end;
}

function clock(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hour = h > 12 ? h - 12 : h;
  return `${hour}:${m.toString().padStart(2, "0")}`;
}

export function formatMeetings(course: Offering) {
  const names = course.days.join(" ");
  return `${names} ${clock(course.start)}–${clock(course.end)}`;
}

export function usePlan() {
  const [catalogCourses, setCatalogCourses] = useState<Offering[]>([]);
  const [selectedSections, setSelectedSections] = useState<Record<string, Offering>>({});
  const [dropped, setDropped] = useState<string[]>([]);
  const [writingHere, setWritingHere] = useState(true);
  const [slotA, setSlotA] = useState(0);
  const [slotB, setSlotB] = useState(0);
  const [slotC, setSlotC] = useState(0);
  const [gen, setGen] = useState(0);
  const [kept, setKept] = useState(false);

  const slotAOptions = [databases, dataScience];
  const slotBOptions = [agi, webApps];
  const slotCOptions = [dataScience, webApps, databases];
  const genOptions = [college, society];

  const placements: Placement[] = [
    {
      id: "os",
      kind: "core",
      course: os,
      dotted: false,
      options: [],
      pick: () => {},
    },
    {
      id: "writing",
      kind: "core",
      course: writing,
      dotted: false,
      options: [],
      pick: () => {},
      deferred: !writingHere,
      defer: () => {
        setWritingHere(false);
        setKept(false);
      },
      restore: () => {
        setWritingHere(true);
        setKept(false);
      },
    },
    {
      id: "a",
      kind: "elective",
      course: slotAOptions[slotA],
      dotted: true,
      options: slotAOptions,
      pick: (code) => {
        setSlotA(slotAOptions.findIndex((item) => item.code === code));
        setKept(false);
      },
    },
    {
      id: "b",
      kind: "elective",
      course: slotBOptions[slotB],
      dotted: true,
      options: slotBOptions,
      pick: (code) => {
        setSlotB(slotBOptions.findIndex((item) => item.code === code));
        setKept(false);
      },
    },
  ];

  if (!writingHere) {
    placements.push({
      id: "c",
      kind: "elective",
      course: slotCOptions[slotC],
      dotted: true,
      options: slotCOptions,
      pick: (code) => {
        setSlotC(slotCOptions.findIndex((item) => item.code === code));
        setKept(false);
      },
    });
  }

  placements.push({
    id: "gen",
    kind: "gened",
    course: genOptions[gen],
    dotted: true,
    options: genOptions,
    pick: (code) => {
      setGen(genOptions.findIndex((item) => item.code === code));
      setKept(false);
    },
  });

  for (const course of catalogCourses) {
    if (!placements.some(item => item.course.code === course.code)) placements.push({ id: `catalog-${course.code}`, kind: "elective", course, dotted: false, options: [], pick: () => {} });
  }

  for (const item of placements) {
    if (selectedSections[item.course.code]) item.course = selectedSections[item.course.code];
    if (dropped.includes(item.id)) item.deferred = true;
  }

  const active = placements.filter((item) => !item.deferred);
  const credits = active.reduce((sum, item) => sum + item.course.credits, 0);
  const over = Math.max(0, credits - CREDIT_MAX);

  const conflicts: Array<[Placement, Placement]> = [];
  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      if (overlaps(active[i].course, active[j].course)) {
        conflicts.push([active[i], active[j]]);
      }
    }
  }

  function conflictsFor(id: string) {
    return conflicts
      .filter(([a, b]) => a.id === id || b.id === id)
      .map(([a, b]) => (a.id === id ? b : a));
  }

  return {
    placements,
    addCourse: (course: Offering) => {
      setSelectedSections(current => ({ ...current, [course.code]: course }));
      const existing = placements.find(item => item.course.code === course.code);
      if (existing) { setDropped(ids => ids.filter(id => id !== existing.id)); existing.restore?.(); }
      else setCatalogCourses(items => items.some(item => item.code === course.code) ? items : [...items, course]);
      setKept(false);
    },
    toggleCourse: (item: Placement) => {
      if (item.deferred) {
        setDropped(ids => ids.filter(id => id !== item.id));
        item.restore?.();
      } else {
        setDropped(ids => [...ids, item.id]);
      }
      setKept(false);
    },
    credits,
    over,
    kept,
    keep: () => setKept(true),
    conflictsFor,
  };
}
