/*
 * The course finder model.
 *
 * Pure functions over `@/data` and the live plan. No React here, so a caller
 * can use these in render, in a memo, or in a test. Course lists are never
 * copied in: everything is read from courses.json, sections.json, program.json,
 * academic-plan.json and student-record.json.
 */
import { courses, degree, sections, studentRecord, suggestedPlan } from "@/data";
import { PLAN_OFFERINGS, sectionOffering, type Offering } from "@/components/plan/data";
import type { Placement, usePlan } from "@/components/plan/use-plan";

/* ---------- Public types ---------- */

export type Scope = "major-elective" | "gened" | "free" | "all";

export type Eligibility =
  | { status: "met" }
  | {
      status: "missing";
      needs: { code: string; title: string }[];
      /*
       * `needs` as the tree reads, one phrase per top-level AND group: CHEM 1034 is
       * ["CHEM 1033 or CHEM 1043", "CHEM 1032 or CHEM 1042"]. Codes keep a no-break space.
       */
      groups: string[];
      raw: string;
    }
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
  /* The bulletin's credits as a range (min === max when fixed), or null when none is listed. */
  creditRange: { min: number; max: number } | null;
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
  /* Which part of the record it is in, so the row can say "Completed" or "In progress". */
  recordStatus: RecordStatus | null;
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


export type RecordStatus = "completed" | "in-progress";

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
 * From the student's degree audit (data/student-record.json). Completed terms and
 * the term in progress both count: Banner lets a student register for a course
 * whose prerequisite is in progress, pending its completion. Registered courses
 * (this term's plan) do not.
 */
const RECORD_STATUS: ReadonlyMap<string, RecordStatus> = new Map(
  studentRecord.terms.flatMap(({ status, courses: taken }) =>
    status === "registered" ? [] : taken.map((c) => [c.code, status] as const),
  ),
);

export const COMPLETED: ReadonlySet<string> = new Set(RECORD_STATUS.keys());

export function recordStatus(code: string): RecordStatus | null {
  return RECORD_STATUS.get(code) ?? null;
}

/* "Completed", "In progress" */
export function recordLabel(status: RecordStatus): string {
  return status === "in-progress" ? "In progress" : "Completed";
}

/* ---------- Gen ed ---------- */

const GENED_AREAS = (find(REQUIREMENTS, "university.gened")?.children ?? []).filter(
  (n) => n.attribute,
);

/* Areas the audit marks complete by exception (World Society), as program.json attributes. */
const BY_EXCEPTION = new Set(
  studentRecord.satisfiedByException.flatMap(({ requirement }) =>
    requirement.startsWith("gened.") ? [requirement.slice("gened.".length).toUpperCase()] : [],
  ),
);

/*
 * The gen ed areas still open, in bulletin order: every area minus those a
 * completed or in-progress course covers, those satisfied by exception, and those
 * the major waives (Quantitative Literacy by Calculus, Science and Technology by
 * the lab science sequence). This term's registered gen eds are its plan, so
 * their areas stay open.
 */
const COVERED = new Set(
  [...COMPLETED].flatMap((code) => BY_CODE.get(code)?.genEdAreas.map((a) => a.toUpperCase()) ?? []),
);

export const OPEN_GENED: { area: string; label: string }[] = GENED_AREAS.flatMap((n) =>
  n.attribute && n.title && n.kind !== "waivedBy" && !COVERED.has(n.attribute) && !BY_EXCEPTION.has(n.attribute)
    ? [{ area: n.attribute, label: n.title }]
    : [],
);

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
  const open = OPEN_GENED.find((g) => c.genEdAreas.some((a) => a.toUpperCase() === g.area));
  if (open) return { kind: "gened", label: `Gen ed · ${open.label}`, area: open.area };
  if (CORE.has(c.code)) return { kind: "core", label: "Required" };
  return { kind: "free", label: "Free elective" };
}

/* ---------- Eligibility ---------- */

type Tri = true | false | null; /* null = cannot evaluate */

/*
 * Three-valued evaluation of the prerequisite tree.
 * - course leaf: in `done` (COMPLETED unless a caller narrows it), or (when
 *   `concurrent`) in the active plan.
 * - subjectRange leaf: any such course with that subject and a number in range.
 * - placement leaf ('Y' in MA07 and similar): unknown. It only matters when
 *   nothing beside it resolves the parent: an `any` with one satisfied course
 *   is met; an `all` with one missing course is missing.
 * Grades are ignored: the record leaves them out, and every completed course meets the C- minimum.
 */
function evaluate(e: Expr, plan: ReadonlySet<string>, done: ReadonlySet<string> = COMPLETED): Tri {
  if ("op" in e) {
    const results = e.of.map((x) => evaluate(x, plan, done));
    if (e.op === "all") {
      if (results.includes(false)) return false;
      return results.includes(null) ? null : true;
    }
    if (results.includes(true)) return true;
    return results.includes(null) ? null : false;
  }
  if (e.kind === "placement") return null;
  const has = (code: string) => done.has(code) || (!!e.concurrent && plan.has(code));
  if (e.kind === "course") return has(e.code);
  const lo = Number(e.from);
  const hi = Number(e.to);
  const pool = [...done, ...(e.concurrent ? plan : [])];
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

/*
 * The same branches as needs(), phrased. A flat "or" would misread an `all` (CHEM 1954
 * needs all three), so an `all` reads "and", and ", and" once its parts hold an "or".
 */
function needsPhrase(e: Expr, plan: ReadonlySet<string>): string | null {
  if (evaluate(e, plan) !== false) return null;
  if ("op" in e) {
    const parts = (e.op === "all" ? e.of : e.of.slice(0, 2))
      .map((x) => needsPhrase(x, plan))
      .filter((x): x is string => !!x);
    if (parts.length <= 1) return parts[0] ?? null;
    if (e.op === "any") return series(parts, "or");
    return parts.some((x) => x.includes(" or ")) ? parts.join(", and ") : series(parts, "and");
  }
  if (e.kind === "placement") return null;
  const code = e.kind === "course" ? e.code : `${e.subject} ${e.from}–${e.to}`;
  return code.replace(" ", "\u00a0");
}

function eligibility(c: RawCourse, plan: ReadonlySet<string>): Eligibility {
  const p = c.prerequisites;
  if (!p?.expression) return { status: "met" };
  const result = evaluate(p.expression, plan);
  if (result === true) return { status: "met" };
  if (result === null) return { status: "unknown", raw: p.raw };
  const seen = new Set<string>();
  const list = needs(p.expression, plan).filter((n) => !seen.has(n.code) && seen.add(n.code));
  const e = p.expression;
  const groups = ("op" in e && e.op === "all" ? e.of : [e])
    .map((x) => needsPhrase(x, plan))
    .filter((x): x is string => !!x);
  return { status: "missing", needs: list, groups, raw: p.raw };
}

/* ---------- Prerequisites, group by group (the course pages on /plan and /find) ---------- */

export type PrereqState = "completed" | "in-progress" | "in-plan" | "missing" | "unknown";
export type PrereqOption = { label: string; title: string | null; met: boolean };
/* One AND group of the tree; its options read joined by `join`. */
export type PrereqGroup = { options: PrereqOption[]; join: "and" | "or"; state: PrereqState };

const FINISHED: ReadonlySet<string> = new Set(
  [...RECORD_STATUS].flatMap(([code, status]) => (status === "completed" ? [code] : [])),
);
const NOTHING: ReadonlySet<string> = new Set();

/*
 * A whole subtree, every option named: "MATH 1042", "any MATH 2043–3080", "MA07 placement".
 * Each code keeps a no-break space, so a long option breaks between codes, never inside one.
 */
function phrase(e: Expr): string {
  if ("op" in e) {
    const parts = e.of.map(phrase);
    if (e.op === "any") return series(parts, "or");
    return parts.some((x) => x.includes(" or ")) ? parts.join(", and ") : series(parts, "and");
  }
  if (e.kind === "course") return e.code.replace(" ", "\u00a0");
  if (e.kind === "subjectRange") return `any ${e.subject}\u00a0${e.from}–${e.to}`;
  return `${e.code}\u00a0placement`;
}

/*
 * The tree as the student needs to read it: one entry per top-level AND group, each
 * with its options and how the record meets it. The earliest that holds wins:
 * completed, in progress, or in the plan (only where the bulletin allows taking it at
 * the same time). An option is `met` when it is what meets the group at that level.
 */
export function prerequisiteGroups(code: string, plan: ReadonlySet<string>): PrereqGroup[] {
  const e = BY_CODE.get(code)?.prerequisites?.expression;
  if (!e) return [];
  const levels: [PrereqState, ReadonlySet<string>, ReadonlySet<string>][] = [
    ["completed", NOTHING, FINISHED],
    ["in-progress", NOTHING, COMPLETED],
    ["in-plan", plan, COMPLETED],
  ];
  return ("op" in e && e.op === "all" ? e.of : [e]).map((group) => {
    const level = levels.find(([, p, done]) => evaluate(group, p, done) === true);
    const state = level?.[0] ?? (evaluate(group, plan) === null ? "unknown" : "missing");
    return {
      join: "op" in group && group.op === "all" ? "and" : "or",
      state,
      options: ("op" in group ? group.of : [group]).map((x) => ({
        label: phrase(x),
        title: !("op" in x) && x.kind === "course" ? (BY_CODE.get(x.code)?.title ?? null) : null,
        met: !!level && evaluate(x, level[1], level[2]) === true,
      })),
    };
  });
}

/* "Completed", "In progress", "In your plan", "Ask your advisor"; null for missing (the row reads "Needs …"). */
export function prereqStateLabel(state: PrereqState): string | null {
  if (state === "completed" || state === "in-progress") return recordLabel(state);
  if (state === "in-plan") return "In your plan";
  if (state === "unknown") return "Ask your advisor";
  return null;
}

export type Unlock = { code: string; title: string; role: "required" | "option" };

/* How `code` appears in a tree: needed outright, or one of several options. */
function roleIn(e: Expr, code: string, inAny = false): Unlock["role"] | null {
  if (!("op" in e)) return e.kind === "course" && e.code === code ? (inAny ? "option" : "required") : null;
  let found: Unlock["role"] | null = null;
  for (const child of e.of) {
    const r = roleIn(child, code, inAny || e.op === "any");
    if (r === "required") return r;
    found ??= r;
  }
  return found;
}

function courseLeaves(e: Expr, out: Set<string>): Set<string> {
  if ("op" in e) e.of.forEach((x) => courseLeaves(x, out));
  else if (e.kind === "course") out.add(e.code);
  return out;
}

/* Reverse prerequisites, built once: the courses whose tree names this one. */
let UNLOCKS: Map<string, Unlock[]> | null = null;
export function prerequisiteFor(code: string): Unlock[] {
  if (!UNLOCKS) {
    UNLOCKS = new Map();
    for (const c of CATALOG) {
      const e = c.prerequisites?.expression;
      if (!e) continue;
      for (const leaf of courseLeaves(e, new Set())) {
        const list = UNLOCKS.get(leaf) ?? [];
        list.push({ code: c.code, title: c.title, role: roleIn(e, leaf) ?? "required" });
        UNLOCKS.set(leaf, list);
      }
    }
    for (const list of UNLOCKS.values()) list.sort((a, b) => a.code.localeCompare(b.code));
  }
  return UNLOCKS.get(code) ?? [];
}

/* ---------- Credits ---------- */

function creditRange({ credits: c }: RawCourse): FinderRow["creditRange"] {
  if (typeof c.value === "number") return { min: c.value, max: c.value };
  const min = c.min ?? (c.options?.length ? Math.min(...c.options) : undefined);
  const max = c.max ?? (c.options?.length ? Math.max(...c.options) : undefined);
  return min === undefined || max === undefined ? null : { min, max };
}

/* ---------- Offering and fit ---------- */

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
  /* The courses the plan hook knows by name (placements and their "Or" options). */
  for (const o of PLAN_OFFERINGS) known.set(o.code, o);
  for (const p of plan.placements) {
    for (const o of p.options) known.set(o.code, o);
    known.set(p.course.code, p.course);
  }

  return CATALOG.map((c) => {
    const s = SECTION_BY_CODE.get(c.code);
    const offering =
      known.get(c.code) ??
      (s
        ? sectionOffering(c, s, "Added from Find courses")
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
      creditRange: creditRange(c),
      description: c.description,
      attributes: c.attributes,
      genEdAreas: c.genEdAreas.map((a) => a.toUpperCase()),
      typicallyOffered: c.typicallyOffered,
      countsFor: countsFor(c),
      eligibility: eligibility(c, activeCodes),
      fit: fit(offering, active),
      inPlan: activeCodes.has(c.code),
      completed: COMPLETED.has(c.code),
      recordStatus: recordStatus(c.code),
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
  { id: "gened", label: "Gen ed" },
  { id: "free", label: "Free elective" },
  { id: "all", label: "All courses" },
];

export const SUBJECTS: string[] = [...new Set(CATALOG.map((c) => c.subject))].sort();

/* ---------- Formatting ---------- */

export function formatCredits(credits: number | null): string {
  return credits === null ? "Variable" : `${credits} cr`;
}

/* "4", "1–6" */
export function formatCreditRange(r: { min: number; max: number }): string {
  return r.min === r.max ? String(r.min) : `${r.min}–${r.max}`;
}

/* "Software Design", "A and B", "A, B and C". Every name, never truncated. */
export function series(items: string[], last: "and" | "or"): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${last} ${items[items.length - 1]}`;
}

const clock = (m: number) =>
  `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, "0")} ${m < 720 ? "am" : "pm"}`;

/* "Tue · Thu 11:00 am–12:20 pm" */
export function formatMeeting(o: Offering): string {
  if (!o.days.length) return "Time to be announced";
  return `${o.days.join(" · ")} ${clock(o.start)}–${clock(o.end)}`;
}
