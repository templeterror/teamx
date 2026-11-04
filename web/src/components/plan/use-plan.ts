"use client";

import { useState } from "react";
import {
  CREDIT_MAX,
  CREDIT_MIN,
  automata,
  compilers,
  constitution,
  dataIntensive,
  dataScience,
  machineLearning,
  meaningOfArts,
  microservices,
  sacredSpace,
  seminar,
  shakespeareMovies,
  socialMovements,
  softwareDesign,
  webApps,
  whyCollege,
  type Offering,
} from "./data";

export type Placement = {
  id: string;
  kind: "core" | "elective" | "gened" | "free-elective";
  course: Offering;
  dotted: boolean;
  options: Offering[];
  pick: (code: string) => void;
  /* Off this term: dropped, or moved to a later term with defer(). */
  deferred?: boolean;
  /* Off because the student pressed Drop. Confirm plan removes these; a later-term course stays. */
  dropped?: boolean;
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

/* "Tue Thu 11:00–11:50 am", or "11:00 am–12:15 pm" across noon: the days and minutes two courses share. */
function sharedTime(a: Offering, b: Offering) {
  const days = a.days.filter((day) => b.days.includes(day)).join(" ");
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  const period = (minutes: number) => (minutes < 720 ? "am" : "pm");
  return period(start) === period(end)
    ? `${days} ${clock(start)}–${clock(end)} ${period(end)}`
    : `${days} ${clock(start)} ${period(start)}–${clock(end)} ${period(end)}`;
}

/* Long titles would push a two-course sentence past two lines; the code says it shorter. */
function nameOf(course: Offering) {
  return course.title.length > 32 ? course.code : course.title;
}

export type PlanProblem = { key: string; kind: "under" | "over" | "conflict"; text: string };

/*
 * What keeps a plan from being confirmed: fewer than 12 credits is not a full-time term,
 * more than 18 needs the department's approval, and Banner will not register two classes
 * that meet at once. Reads only the courses in the plan, never a preview.
 */
export function planProblems(active: Placement[]): PlanProblem[] {
  const credits = active.reduce((sum, item) => sum + item.course.credits, 0);
  const problems: PlanProblem[] = [];
  if (active.length && credits < CREDIT_MIN) {
    problems.push({
      key: "under",
      kind: "under",
      text: `${credits} credits is under the ${CREDIT_MIN}-credit minimum for a full-time term. Add a course to reach ${CREDIT_MIN}.`,
    });
  }
  if (credits > CREDIT_MAX) {
    problems.push({
      key: "over",
      kind: "over",
      text: `${credits} credits is over the ${CREDIT_MAX}-credit limit. Drop a course, or get approval from your department to take more.`,
    });
  }
  for (const [a, b] of conflictPairs(active)) {
    problems.push({
      key: `${a.id}-${b.id}`,
      kind: "conflict",
      text: `${nameOf(a.course)} and ${nameOf(b.course)} overlap on ${sharedTime(a.course, b.course)}. Swap or drop one.`,
    });
  }
  return problems;
}

function conflictPairs(active: Placement[]) {
  const pairs: Array<[Placement, Placement]> = [];
  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      if (overlaps(active[i].course, active[j].course)) pairs.push([active[i], active[j]]);
    }
  }
  return pairs;
}

/* The reason line on the card of a course the student shortlisted on /find. */
export const SHORTLIST_WHY = "You shortlisted this";

export function usePlan() {
  const [catalogCourses, setCatalogCourses] = useState<Offering[]>([]);
  const [selectedSections, setSelectedSections] = useState<Record<string, Offering>>({});
  const [dropped, setDropped] = useState<string[]>([]);
  const [writingHere, setWritingHere] = useState(true);
  const [slotA, setSlotA] = useState(0);
  const [slotB, setSlotB] = useState(0);
  const [slotC, setSlotC] = useState(0);
  const [arts, setArts] = useState(0);
  const [usSociety, setUsSociety] = useState(0);
  const [kept, setKept] = useState(false);
  /* Per-course confirmation. Lives here, not in the schedule, so /plan/review can read it. */
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  /* Codes that arrived from the shortlist, so their cards can say so. */
  const [fromShortlist, setFromShortlist] = useState<ReadonlySet<string>>(() => new Set());
  /* Dropped placements that Confirm plan removed. Adding the course again brings it back. */
  const [cleared, setCleared] = useState<string[]>([]);

  /* Each slot starts on the course the student registered for; the rest are its "Or" options. */
  const slotAOptions = [machineLearning, dataScience, dataIntensive];
  const slotBOptions = [seminar, microservices, compilers];
  /* Only while Software Design is moved to a later term. */
  const slotCOptions = [webApps, automata];
  const artsOptions = [meaningOfArts, sacredSpace, shakespeareMovies];
  const usSocietyOptions = [whyCollege, socialMovements, constitution];

  const placements: Placement[] = [
    {
      id: "software-design",
      kind: "core",
      course: softwareDesign,
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

  placements.push(
    {
      id: "arts",
      kind: "gened",
      course: artsOptions[arts],
      dotted: true,
      options: artsOptions,
      pick: (code) => {
        setArts(artsOptions.findIndex((item) => item.code === code));
        setKept(false);
      },
    },
    {
      id: "us-society",
      kind: "gened",
      course: usSocietyOptions[usSociety],
      dotted: true,
      options: usSocietyOptions,
      pick: (code) => {
        setUsSociety(usSocietyOptions.findIndex((item) => item.code === code));
        setKept(false);
      },
    },
  );

  for (const course of catalogCourses) {
    if (!placements.some(item => item.course.code === course.code)) placements.push({ id: `catalog-${course.code}`, kind: "elective", course, dotted: false, options: [], pick: () => {} });
  }

  for (const item of placements) {
    if (selectedSections[item.course.code]) item.course = selectedSections[item.course.code];
    if (dropped.includes(item.id)) {
      item.deferred = true;
      item.dropped = true;
    }
  }

  const visible = placements.filter((item) => !cleared.includes(item.id));
  const active = visible.filter((item) => !item.deferred);
  const credits = active.reduce((sum, item) => sum + item.course.credits, 0);
  /* Dropped, still on screen: Confirm plan removes them. */
  const pendingDrops = visible.filter((item) => item.dropped);
  const conflicts = conflictPairs(active);
  const problems = planProblems(active);
  /*
   * The semester is confirmed only when every course in it is. A new course reopens it,
   * and so does a drop, until Confirm plan removes the course or Add undoes it.
   * With a problem (under 12 credits, over 18, two classes at once) it is never confirmed.
   */
  const planConfirmed =
    active.length > 0 &&
    active.every((item) => confirmed[item.id]) &&
    pendingDrops.length === 0 &&
    problems.length === 0;

  function conflictsFor(id: string) {
    return conflicts
      .filter(([a, b]) => a.id === id || b.id === id)
      .map(([a, b]) => (a.id === id ? b : a));
  }

  function addCourse(course: Offering) {
    setSelectedSections(current => ({ ...current, [course.code]: course }));
    const existing = placements.find(item => item.course.code === course.code);
    if (existing) {
      setDropped(ids => ids.filter(id => id !== existing.id));
      setCleared(ids => ids.filter(id => id !== existing.id));
      existing.restore?.();
    }
    else setCatalogCourses(items => items.some(item => item.code === course.code) ? items : [...items, course]);
    setKept(false);
  }

  return {
    placements: visible,
    addCourse,
    /* Shortlisted courses arrive as suggestions, like the planner's own, and say who picked them. */
    addShortlisted: (courses: Offering[]) => {
      const arriving = courses.filter(course => !active.some(item => item.course.code === course.code));
      if (!arriving.length) return;
      for (const course of arriving) addCourse({ ...course, why: SHORTLIST_WHY });
      const ids = arriving.map(course => placements.find(item => item.course.code === course.code)?.id ?? `catalog-${course.code}`);
      setFromShortlist(codes => new Set([...codes, ...arriving.map(course => course.code)]));
      setConfirmed(current => ({ ...current, ...Object.fromEntries(ids.map(id => [id, false])) }));
    },
    fromShortlist,
    /* Confirm plan: every course in the plan is confirmed and every dropped one leaves it. Refused while a problem stands. */
    confirmPlan: () => {
      if (problems.length) return;
      const gone = pendingDrops.map(item => item.id);
      /* A removed course loses its confirmation, so adding it again later reopens the plan. */
      setConfirmed(current => ({
        ...current,
        ...Object.fromEntries(active.map(item => [item.id, true])),
        ...Object.fromEntries(gone.map(id => [id, false])),
      }));
      if (gone.length) setCleared(ids => [...ids, ...gone]);
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
    problems,
    kept,
    keep: () => setKept(true),
    conflictsFor,
    conflicts,
    confirmed,
    setConfirmed,
    pendingDrops,
    planConfirmed,
  };
}
