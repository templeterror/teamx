/*
 * The course finder model.
 *
 * Pure functions over `@/data` and the live plan. No React here, so a caller
 * can use these in render, in a memo, or in a test. Course lists are never
 * copied in: everything is read from courses.json, sections.json, program.json
 * and academic-plan.json.
 */
import { courses, degree, sections, suggestedPlan } from "@/data";
import {
  agi,
  college,
  dataScience,
  databases,
  os,
  society,
  webApps,
  writing,
  type Day,
  type Offering,
} from "@/components/plan/data";
import type { Placement, usePlan } from "@/components/plan/use-plan";

/* ---------- Public types ---------- */

export type Scope = "major-elective" | "gened" | "free" | "all";

export type Eligibility =
  | { status: "met" }
  | { status: "missing"; needs: { code: string; title: string }[]; raw: string }
  | { status: "unknown"; raw: string };

export type Fit =
  | { status: "fits" }
  | { status: "conflict"; with: { code: string; title: string }[] };

export type CountsFor = {
  kind: "major-elective" | "gened" | "free" | "core";
  label: string;
  area?: string;
};

export type FinderRow = {
  code: string;
  subject: string;
  number: string;
  title: string;
  /* null = variable credits (options or a range in the bulletin). */
  credits: number | null;
  description: string;
  attributes: string[];
  /* Upper case, e.g. ["GU"]. */
  genEdAreas: string[];
  typicallyOffered: string | null;
  countsFor: CountsFor;
  eligibility: Eligibility;
  fit: Fit;
  /* An active (non-deferred) placement in the plan. */
  inPlan: boolean;
  /* In the student's completed set (see COMPLETED below). Taking it again is not useful. */
  completed: boolean;
  /* Bulletin restrictions joined into one line (cohort, field of study...), or null. */
  restriction: string | null;
  /*
   * What addCourse() receives. For a course the plan already knows (a placement
   * or one of its "Or" options) this is the plan's own Offering, so the finder
   * and the week agree on meeting time. Otherwise it is the placeholder section.
   */
  offering: Offering;
  section: { id: string; section: string; instructor: string; campus: string };
};

export type Plan = ReturnType<typeof usePlan>;
export type PlanLike = Pick<Plan, "placements" | "addCourse" | "toggleCourse">;


/* ---------- Raw data shapes (the JSON is typed loosely on purpose) ---------- */

type Leaf =
  | { kind: "course"; code: string; concurrent?: boolean; minGrade?: string }
  | { kind: "subjectRange"; subject: string; from: string; to: string; concurrent?: boolean }
  | { kind: "placement"; code: string };
type Expr = { op: "all" | "any"; of: Expr[] } | Leaf;

type RawCourse = {
  code: string;
  subject: string;
  number: string;
  title: string;
  credits: { value?: number; options?: number[]; min?: number; max?: number };
  description: string;
  typicallyOffered: string | null;
  attributes: string[];
  prerequisites: { raw: string; expression: Expr | null } | null;
  restrictions: Record<string, string>;
  genEdAreas: string[];
};

type RawSection = {
  id: string;
  course: string;
  section: string;
  days: string[];
  start: string;
  end: string;
  instructor: string;
  campus: string;
};

type ReqNode = {
  id?: string;
  kind: string;
  title?: string;
  attribute?: string;
  code?: string;
  courses?: string[];
  children?: ReqNode[];
  options?: { a: (string | string[])[]; b: (string | string[])[] }[];
};

type PlanRow = { kind: string; code?: string; courses?: string[] };

const CATALOG = Object.values(courses) as unknown as RawCourse[];
const BY_CODE = new Map(CATALOG.map((c) => [c.code, c]));
const SECTION_BY_CODE = new Map(
  (sections as unknown as RawSection[]).map((s) => [s.course, s]),
);
const REQUIREMENTS = (degree as unknown as { requirements: ReqNode[] }).requirements;
const YEARS = (
  suggestedPlan as unknown as { years: { year: number; terms: { rows: PlanRow[] }[] }[] }
).years;

/* The courses the plan hook knows by name (placements and their "Or" options). */
const KNOWN_OFFERINGS = [os, writing, databases, dataScience, agi, webApps, college, society];

function titleOf(code: string) {
  return BY_CODE.get(code)?.title ?? code;
}

function rowCodes(row: PlanRow): string[] {
  if (row.kind === "course" && row.code) return [row.code];
  if (row.kind === "oneOf" && row.courses) return row.courses;
  return [];
}

function find(nodes: ReqNode[], id: string): ReqNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = n.children && find(n.children, id);
    if (hit) return hit;
  }
  return undefined;
}

/* ---------- Completed set ---------- */

/*
 * Rule (a sample, not a transcript): the demo student finished years 1-3 of
 * the bulletin's suggested plan. Every `course` row counts, and every option of
 * a `oneOf` row counts (we do not know which one they picked, so any of them
 * satisfies a prerequisite). Courses in this term's plan (the Offerings in
 * components/plan/data.ts, e.g. CIS 3207 which the suggested plan puts in
 * year 3) are taken out, same as components/plan/terms.ts does for the record.
 */
const IN_THIS_TERM = new Set(KNOWN_OFFERINGS.map((o) => o.code));
export const COMPLETED: ReadonlySet<string> = new Set(
  YEARS.filter((y) => y.year <= 3)
    .flatMap((y) => y.terms.flatMap((t) => t.rows.flatMap(rowCodes)))
    .filter((code) => !IN_THIS_TERM.has(code)),
);

/* ---------- Gen ed ---------- */

const GENED_AREAS = (find(REQUIREMENTS, "university.gened")?.children ?? []).filter(
  (n) => n.attribute,
);

/*
 * The one gen ed still open is the area the plan's "gened" placement satisfies.
 * The hook's gened slot defaults to `college` (AMST 0862); its options are all
 * the same area, so we resolve that course against program.json.
 */
export const OPEN_GENED: { area: string; label: string } = (() => {
  const area = GENED_AREAS.find((n) => n.courses?.includes(college.code));
  return area?.attribute && area.title
    ? { area: area.attribute, label: area.title }
    : { area: "GU", label: "U.S. Society" };
})();

/* ---------- Counts for ---------- */

const MAJOR_ELECTIVES = new Set(find(REQUIREMENTS, "major.electives")?.courses ?? []);

function namedCourses(node: ReqNode): string[] {
  if (node.kind === "creditsFrom") return []; /* the elective pool is not "required" */
  const own = [
    ...(node.code ? [node.code] : []),
    ...(node.kind === "oneOf" ? (node.courses ?? []) : []),
    ...(node.options ?? []).flatMap((o) => [...o.a, ...o.b].flat()),
  ];
  return [...own, ...(node.children ?? []).flatMap(namedCourses)];
}

/* Named in the major tree (cores, capstone, calculus, lab science) or anywhere in the suggested plan. */
const CORE = new Set([
  ...namedCourses(find(REQUIREMENTS, "major") ?? { kind: "all" }),
  ...YEARS.flatMap((y) => y.terms.flatMap((t) => t.rows.flatMap(rowCodes))),
]);

function countsFor(c: RawCourse): CountsFor {
  if (MAJOR_ELECTIVES.has(c.code)) return { kind: "major-elective", label: "Major elective" };
  /* A gen ed for an area already finished (or waived) is just a free elective. */
  if (c.genEdAreas.some((a) => a.toUpperCase() === OPEN_GENED.area))
    return { kind: "gened", label: `Gen ed · ${OPEN_GENED.label}`, area: OPEN_GENED.area };
  if (CORE.has(c.code)) return { kind: "core", label: "Required" };
  return { kind: "free", label: "Free elective" };
}

/* ---------- Eligibility ---------- */

type Tri = true | false | null; /* null = cannot evaluate */

/*
 * Three-valued evaluation of the prerequisite tree.
 * - course leaf: in COMPLETED, or (when `concurrent`) in the active plan.
 * - subjectRange leaf: any such course with that subject and a number in range.
 * - placement leaf ('Y' in MA07 and similar): unknown. It only matters when
 *   nothing beside it resolves the parent: an `any` with one satisfied course
 *   is met; an `all` with one missing course is missing.
 * Grades are ignored (the sample record has none).
 */
function evaluate(e: Expr, plan: ReadonlySet<string>): Tri {
  if ("op" in e) {
    const results = e.of.map((x) => evaluate(x, plan));
    if (e.op === "all") {
      if (results.includes(false)) return false;
      return results.includes(null) ? null : true;
    }
    if (results.includes(true)) return true;
    return results.includes(null) ? null : false;
  }
  if (e.kind === "placement") return null;
  const has = (code: string) => COMPLETED.has(code) || (!!e.concurrent && plan.has(code));
  if (e.kind === "course") return has(e.code);
  const lo = Number(e.from);
  const hi = Number(e.to);
  const pool = [...COMPLETED, ...(e.concurrent ? plan : [])];
  return pool.some((code) => {
    const [subject, num] = code.split(" ");
    return subject === e.subject && Number(num) >= lo && Number(num) <= hi;
  });
}

/* What would satisfy the unmet parts. For an `any`, the first two options. */
function needs(e: Expr, plan: ReadonlySet<string>): { code: string; title: string }[] {
  if (evaluate(e, plan) !== false) return [];
  if ("op" in e) {
    const parts = e.op === "all" ? e.of : e.of.slice(0, 2);
    return parts.flatMap((x) => needs(x, plan));
  }
  if (e.kind === "course") return [{ code: e.code, title: titleOf(e.code) }];
  if (e.kind === "subjectRange")
    return [
      { code: `${e.subject} ${e.from}–${e.to}`, title: `Any ${e.subject} course ${e.from}–${e.to}` },
    ];
  return [];
}

function eligibility(c: RawCourse, plan: ReadonlySet<string>): Eligibility {
  const p = c.prerequisites;
  if (!p?.expression) return { status: "met" };
  const result = evaluate(p.expression, plan);
  if (result === true) return { status: "met" };
  if (result === null) return { status: "unknown", raw: p.raw };
  const seen = new Set<string>();
  const list = needs(p.expression, plan).filter((n) => !seen.has(n.code) && seen.add(n.code));
  return { status: "missing", needs: list, raw: p.raw };
}

/* ---------- Offering and fit ---------- */

const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

function sectionOffering(c: RawCourse, s: RawSection): Offering {
  return {
    code: c.code,
    title: c.title,
    credits: c.credits.value ?? 0,
    days: s.days.map((d) => d.slice(0, 3) as Day),
    start: minutes(s.start),
    end: minutes(s.end),
    why: "Added from Find courses",
  };
}

function overlaps(a: Offering, b: Offering) {
  return a.days.some((d) => b.days.includes(d)) && a.start < b.end && b.start < a.end;
}

function fit(o: Offering, active: Placement[]): Fit {
  const clashes = active.filter((p) => p.course.code !== o.code && overlaps(p.course, o));
  return clashes.length
    ? { status: "conflict", with: clashes.map((p) => ({ code: p.course.code, title: p.course.title })) }
    : { status: "fits" };
}

/* ---------- Rows ---------- */

export function buildRows(plan: PlanLike): FinderRow[] {
  const active = plan.placements.filter((p) => !p.deferred);
  const activeCodes = new Set(active.map((p) => p.course.code));
  /* Offerings the plan already holds, so a row never disagrees with the week. */
  const known = new Map<string, Offering>();
  for (const o of KNOWN_OFFERINGS) known.set(o.code, o);
  for (const p of plan.placements) {
    for (const o of p.options) known.set(o.code, o);
    known.set(p.course.code, p.course);
  }

  return CATALOG.map((c) => {
    const s = SECTION_BY_CODE.get(c.code);
    const offering =
      known.get(c.code) ??
      (s
        ? sectionOffering(c, s)
        : { code: c.code, title: c.title, credits: c.credits.value ?? 0, days: [], start: 0, end: 0, why: "Added from Find courses" });
    const restriction = Object.entries(c.restrictions ?? {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · ");
    return {
      code: c.code,
      subject: c.subject,
      number: c.number,
      title: c.title,
      credits: typeof c.credits.value === "number" ? c.credits.value : null,
      description: c.description,
      attributes: c.attributes,
      genEdAreas: c.genEdAreas.map((a) => a.toUpperCase()),
      typicallyOffered: c.typicallyOffered,
      countsFor: countsFor(c),
      eligibility: eligibility(c, activeCodes),
      fit: fit(offering, active),
      inPlan: activeCodes.has(c.code),
      completed: COMPLETED.has(c.code),
      restriction: restriction || null,
      offering,
      section: s
        ? { id: s.id, section: s.section, instructor: s.instructor, campus: s.campus }
        : { id: "", section: "", instructor: "", campus: "" },
    };
  }).sort((a, b) => a.code.localeCompare(b.code));
}

/* A course the finder added arrives as "elective"; colour it by what it counts for instead. */
export function rowKind(row: FinderRow): Placement["kind"] {
  const k = row.countsFor.kind;
  return k === "major-elective" ? "elective" : k === "free" ? "free-elective" : k;
}

/* ---------- Search and scope ---------- */

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/* Ranked: code prefix > code contains > title contains > description contains. Stable inside a tier. */
export function searchRows(rows: FinderRow[], query: string): FinderRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const qs = squash(q);
  const tier = (r: FinderRow) => {
    const code = squash(r.code);
    if (qs && code.startsWith(qs)) return 0;
    if (qs && code.includes(qs)) return 1;
    if (r.title.toLowerCase().includes(q)) return 2;
    if (r.description.toLowerCase().includes(q)) return 3;
    return -1;
  };
  return rows
    .map((r, i) => ({ r, i, t: tier(r) }))
    .filter((x) => x.t >= 0)
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map((x) => x.r);
}

export function scopeRows(rows: FinderRow[], scope: Scope): FinderRow[] {
  return scope === "all" ? rows : rows.filter((r) => r.countsFor.kind === scope);
}

export function scopeCounts(rows: FinderRow[]): Record<Scope, number> {
  const counts: Record<Scope, number> = { "major-elective": 0, gened: 0, free: 0, all: rows.length };
  for (const r of rows) if (r.countsFor.kind !== "core") counts[r.countsFor.kind] += 1;
  return counts;
}

export const SCOPES: { id: Scope; label: string }[] = [
  { id: "major-elective", label: "Major elective" },
  { id: "gened", label: `Gen ed · ${OPEN_GENED.label}` },
  { id: "free", label: "Free elective" },
  { id: "all", label: "All courses" },
];

export const SUBJECTS: string[] = [...new Set(CATALOG.map((c) => c.subject))].sort();

/* ---------- Formatting ---------- */

export function formatCredits(credits: number | null): string {
  return credits === null ? "Variable" : `${credits} cr`;
}

const clock = (m: number) =>
  `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, "0")} ${m < 720 ? "am" : "pm"}`;

/* "Tue · Thu 11:00 am–12:20 pm" */
export function formatMeeting(o: Offering): string {
  if (!o.days.length) return "Time to be announced";
  return `${o.days.join(" · ")} ${clock(o.start)}–${clock(o.end)}`;
}
