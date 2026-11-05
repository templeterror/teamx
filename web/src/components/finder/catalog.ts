/*
 * The course finder model.
 *
 * Pure functions over `@/data` and the live plan. No React here, so a caller
 * can use these in render, in a memo, or in a test. Course lists are never
 * copied in: everything is read from courses.json, sections.json, the program's
 * requirement tree and suggested plan, and the signed-in student's record.
 *
 * What depends on the student (their record, their program's tree) lives on a
 * Catalog built once per program by catalogFor(); the rest is plain functions.
 */
import { DEFAULT_PROGRAM, courses, programs, sections, type ProgramCode } from "@/data";
import { sectionOffering, startingOfferings, type Offering } from "@/components/plan/data";
import type { Placement, usePlan } from "@/components/plan/use-plan";
import { REQUIRED_FROM, profileForProgram } from "@/components/student/student";

/* ---------- Public types ---------- */

/* "major-elective" is the program's elective requirement, whatever it is called (Catalog.elective). */
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
  /* In the student's completed set (Catalog.completed). Taking it again is not useful. */
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

type RangeLeaf = Extract<Leaf, { kind: "subjectRange" }>;

type ReqNode = {
  id?: string;
  kind: string;
  title?: string;
  attribute?: string;
  code?: string;
  courses?: string[];
  children?: ReqNode[];
  options?: { a: (string | string[])[]; b: (string | string[])[] }[];
  /* An elective pool given as subject ranges (the Fox business electives). */
  pool?: RangeLeaf[];
  /* A gen ed area waived by completing any of these courses (GQ). */
  waivedBy?: string[];
  /* A gen ed area waived by completing another requirement, e.g. "major" (CS GS). */
  waivedByRequirement?: string;
};

type PlanRow = { kind: string; code?: string; courses?: string[] };

const CATALOG = Object.values(courses) as unknown as RawCourse[];
const BY_CODE = new Map(CATALOG.map((c) => [c.code, c]));
const SECTION_BY_CODE = new Map(
  (sections as unknown as RawSection[]).map((s) => [s.course, s]),
);

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

/* ---------- Record ---------- */

/*
 * From the student's degree audit (data/student-record.json; a new student's is
 * empty). Completed terms and the term in progress both count: Banner lets a
 * student register for a course whose prerequisite is in progress, pending its
 * completion. Registered courses (this term's plan) do not.
 */
function recordStatuses(program: ProgramCode): ReadonlyMap<string, RecordStatus> {
  return new Map(
    profileForProgram(program).record.terms.flatMap(({ status, courses: taken }) =>
      status === "registered" ? [] : taken.map((c) => [c.code, status] as const),
    ),
  );
}

/* "Completed", "In progress" */
export function recordLabel(status: RecordStatus): string {
  return status === "in-progress" ? "In progress" : "Completed";
}

/* ---------- Gen ed ---------- */

/*
 * An area is waived only when its condition holds, as the tree states it: any of its
 * `waivedBy` courses completed (MIS: STAT 2103 waives GQ), or its `waivedByRequirement`
 * (CS: completing a CST major waives GS). The planner treats a student as on track for
 * their own major, so a requirement waiver counts from the start.
 */
function waived(n: ReqNode, completed: ReadonlySet<string>) {
  if (n.waivedByRequirement) return true;
  return (n.waivedBy ?? []).some((code) => completed.has(code));
}

/*
 * The gen ed areas still open, in bulletin order: every area minus those a completed
 * or in-progress course covers, those the audit satisfied by exception (World Society),
 * and those waived (above). This term's registered gen eds are its plan, so their
 * areas stay open.
 */
function openGened(
  requirements: ReqNode[],
  completed: ReadonlySet<string>,
  satisfiedByException: { requirement: string }[],
): { area: string; label: string }[] {
  const byException = new Set(
    satisfiedByException.flatMap(({ requirement }) =>
      requirement.startsWith("gened.") ? [requirement.slice("gened.".length).toUpperCase()] : [],
    ),
  );
  const covered = new Set(
    [...completed].flatMap((code) => BY_CODE.get(code)?.genEdAreas.map((a) => a.toUpperCase()) ?? []),
  );
  return (find(requirements, "university.gened")?.children ?? []).flatMap((n) =>
    n.attribute && n.title && !waived(n, completed) && !covered.has(n.attribute) && !byException.has(n.attribute)
      ? [{ area: n.attribute, label: n.title }]
      : [],
  );
}

/* ---------- Counts for ---------- */

/*
 * The program's elective requirement: its first `creditsFrom` node with courses to
 * choose from. CS lists them (`major.electives`); the BBA gives subject ranges
 * (`fox.upper-foundation.business-electives`). Inside the major it reads "Major
 * elective", the words students use; otherwise it takes the node's own title.
 */
type Electives = {
  one: string;
  many: string;
  listed: ReadonlySet<string>;
  pool: RangeLeaf[];
};

function electives(requirements: ReqNode[]): Electives {
  const walk = (nodes: ReqNode[], inMajor: boolean): Electives | null => {
    for (const n of nodes) {
      const here = inMajor || n.id === "major";
      if (n.kind === "creditsFrom" && (n.courses?.length || n.pool?.length)) {
        const many = here ? "Major electives" : (n.title ?? "Electives");
        return { one: many.replace(/s$/, ""), many, listed: new Set(n.courses ?? []), pool: n.pool ?? [] };
      }
      const hit = n.children && walk(n.children, here);
      if (hit) return hit;
    }
    return null;
  };
  return walk(requirements, false) ?? { one: "Elective", many: "Electives", listed: new Set(), pool: [] };
}

function inRange(code: string, r: RangeLeaf) {
  const [subject, num] = code.split(" ");
  return subject === r.subject && Number(num) >= Number(r.from) && Number(num) <= Number(r.to);
}

function namedCourses(node: ReqNode): string[] {
  if (node.kind === "creditsFrom") return []; /* the elective pool is not "required" */
  const own = [
    ...(node.code ? [node.code] : []),
    ...(node.kind === "oneOf" ? (node.courses ?? []) : []),
    ...(node.options ?? []).flatMap((o) => [...o.a, ...o.b].flat()),
  ];
  return [...own, ...(node.children ?? []).flatMap(namedCourses)];
}

/*
 * Named in the program's required nodes (CS: the major's cores, capstone, calculus, lab
 * science; MIS: the Fox foundation, the major's courses, capstone and professional
 * development) or anywhere in the suggested plan.
 */
function requiredCourses(program: ProgramCode, requirements: ReqNode[]): ReadonlySet<string> {
  const years = (
    programs[program].plan as unknown as { years: { terms: { rows: PlanRow[] }[] }[] }
  ).years;
  return new Set([
    ...REQUIRED_FROM[program].flatMap((id) => namedCourses(find(requirements, id) ?? { kind: "all" })),
    ...years.flatMap((y) => y.terms.flatMap((t) => t.rows.flatMap(rowCodes))),
  ]);
}

/*
 * A listed elective wins over everything, as it always has for CS. A subject-range pool
 * comes after gen ed and Required: 2000–3999 in sixteen subjects would otherwise swallow
 * the foundation's own STAT 2103, ACCT 2103 and MIS 2402, and the bulletin does not say
 * a required course can double as a business elective (needsReview business-elective-pool).
 */
function countsFor(
  c: RawCourse,
  e: Electives,
  open: { area: string; label: string }[],
  required: ReadonlySet<string>,
): CountsFor {
  const elective: CountsFor = { kind: "major-elective", label: e.one };
  if (e.listed.has(c.code)) return elective;
  /* A gen ed for an area already finished (or waived) is just a free elective. */
  const area = open.find((g) => c.genEdAreas.some((a) => a.toUpperCase() === g.area));
  if (area) return { kind: "gened", label: `Gen ed · ${area.label}`, area: area.area };
  if (required.has(c.code)) return { kind: "core", label: "Required" };
  if (e.pool.some((r) => inRange(c.code, r))) return elective;
  return { kind: "free", label: "Free elective" };
}

/* ---------- Eligibility ---------- */

type Tri = true | false | null; /* null = cannot evaluate */

/*
 * Three-valued evaluation of the prerequisite tree.
 * - course leaf: in `done` (the completed set unless a caller narrows it), or (when
 *   `concurrent`) in the active plan.
 * - subjectRange leaf: any such course with that subject and a number in range.
 * - placement leaf ('Y' in MA07 and similar): unknown. It only matters when
 *   nothing beside it resolves the parent: an `any` with one satisfied course
 *   is met; an `all` with one missing course is missing.
 * Grades are ignored: the record leaves them out, and every completed course meets the C- minimum.
 */
function evaluate(e: Expr, plan: ReadonlySet<string>, done: ReadonlySet<string>): Tri {
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
function needs(e: Expr, plan: ReadonlySet<string>, done: ReadonlySet<string>): { code: string; title: string }[] {
  if (evaluate(e, plan, done) !== false) return [];
  if ("op" in e) {
    const parts = e.op === "all" ? e.of : e.of.slice(0, 2);
    return parts.flatMap((x) => needs(x, plan, done));
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
function needsPhrase(e: Expr, plan: ReadonlySet<string>, done: ReadonlySet<string>): string | null {
  if (evaluate(e, plan, done) !== false) return null;
  if ("op" in e) {
    const parts = (e.op === "all" ? e.of : e.of.slice(0, 2))
      .map((x) => needsPhrase(x, plan, done))
      .filter((x): x is string => !!x);
    if (parts.length <= 1) return parts[0] ?? null;
    if (e.op === "any") return series(parts, "or");
    return parts.some((x) => x.includes(" or ")) ? parts.join(", and ") : series(parts, "and");
  }
  if (e.kind === "placement") return null;
  const code = e.kind === "course" ? e.code : `${e.subject} ${e.from}–${e.to}`;
  return code.replace(" ", "\u00a0");
}

function eligibility(c: RawCourse, plan: ReadonlySet<string>, done: ReadonlySet<string>): Eligibility {
  const p = c.prerequisites;
  if (!p?.expression) return { status: "met" };
  const result = evaluate(p.expression, plan, done);
  if (result === true) return { status: "met" };
  if (result === null) return { status: "unknown", raw: p.raw };
  const seen = new Set<string>();
  const list = needs(p.expression, plan, done).filter((n) => !seen.has(n.code) && seen.add(n.code));
  const e = p.expression;
  const groups = ("op" in e && e.op === "all" ? e.of : [e])
    .map((x) => needsPhrase(x, plan, done))
    .filter((x): x is string => !!x);
  return { status: "missing", needs: list, groups, raw: p.raw };
}

/* The four-year board uses its own history and respects same-term prerequisites. */
export function sequencePrerequisite(
  code: string,
  earlier: ReadonlySet<string>,
  sameTerm: ReadonlySet<string>,
): { status: "missing" | "unknown"; raw: string } | null {
  const prerequisite = BY_CODE.get(code)?.prerequisites;
  if (!prerequisite) return null;
  const result = prerequisite.expression
    ? evaluate(prerequisite.expression, sameTerm, earlier)
    : null;
  if (result === true) return null;
  return { status: result === false ? "missing" : "unknown", raw: prerequisite.raw };
}

/* ---------- Prerequisites, group by group (the course pages on /plan and /find) ---------- */

export type PrereqState = "completed" | "in-progress" | "in-plan" | "missing" | "unknown";
export type PrereqOption = { label: string; title: string | null; met: boolean };
/* One AND group of the tree; its options read joined by `join`. */
export type PrereqGroup = { options: PrereqOption[]; join: "and" | "or"; state: PrereqState };

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
function prerequisiteGroups(
  code: string,
  plan: ReadonlySet<string>,
  finished: ReadonlySet<string>,
  completed: ReadonlySet<string>,
): PrereqGroup[] {
  const e = BY_CODE.get(code)?.prerequisites?.expression;
  if (!e) return [];
  const levels: [PrereqState, ReadonlySet<string>, ReadonlySet<string>][] = [
    ["completed", NOTHING, finished],
    ["in-progress", NOTHING, completed],
    ["in-plan", plan, completed],
  ];
  return ("op" in e && e.op === "all" ? e.of : [e]).map((group) => {
    const level = levels.find(([, p, done]) => evaluate(group, p, done) === true);
    const state = level?.[0] ?? (evaluate(group, plan, completed) === null ? "unknown" : "missing");
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

type Student = {
  completed: ReadonlySet<string>;
  statuses: ReadonlyMap<string, RecordStatus>;
  countsFor: (c: RawCourse) => CountsFor;
  /* Offerings the plan opens with, including the ones not on screen yet (CS's later-term swap). */
  starting: Offering[];
};

function buildRows(plan: PlanLike, student: Student): FinderRow[] {
  const active = plan.placements.filter((p) => !p.deferred);
  const activeCodes = new Set(active.map((p) => p.course.code));
  /* Offerings the plan already holds, so a row never disagrees with the week. */
  const known = new Map<string, Offering>();
  /* The courses the plan hook knows by name (placements and their "Or" options). */
  for (const o of student.starting) known.set(o.code, o);
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
      countsFor: student.countsFor(c),
      eligibility: eligibility(c, activeCodes, student.completed),
      fit: fit(offering, active),
      inPlan: activeCodes.has(c.code),
      completed: student.completed.has(c.code),
      recordStatus: student.statuses.get(c.code) ?? null,
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

export const SUBJECTS: string[] = [...new Set(CATALOG.map((c) => c.subject))].sort();

/* ---------- Per program ---------- */

/*
 * Everything the finder reads that depends on who is signed in: their record and
 * their program's tree. Built once per program, then shared by every render.
 */
export type Catalog = {
  program: ProgramCode;
  /* Completed and in-progress courses (see recordStatuses). */
  completed: ReadonlySet<string>;
  openGened: { area: string; label: string }[];
  /* The program's elective requirement: "Major elective" (CS), "Business elective" (MIS). */
  elective: { one: string; many: string };
  /* The "Counts for" chips, in order. */
  scopes: { id: Scope; label: string }[];
  recordStatus: (code: string) => RecordStatus | null;
  buildRows: (plan: PlanLike) => FinderRow[];
  prerequisiteGroups: (code: string, plan: ReadonlySet<string>) => PrereqGroup[];
};

function buildCatalog(program: ProgramCode): Catalog {
  const record = profileForProgram(program).record;
  const requirements = (programs[program].degree as unknown as { requirements: ReqNode[] }).requirements;
  const statuses = recordStatuses(program);
  const completed: ReadonlySet<string> = new Set(statuses.keys());
  const finished: ReadonlySet<string> = new Set(
    [...statuses].flatMap(([code, status]) => (status === "completed" ? [code] : [])),
  );
  const open = openGened(requirements, completed, record.satisfiedByException);
  const e = electives(requirements);
  const required = requiredCourses(program, requirements);
  const student: Student = {
    completed,
    statuses,
    countsFor: (c) => countsFor(c, e, open, required),
    starting: startingOfferings(program),
  };
  return {
    program,
    completed,
    openGened: open,
    elective: { one: e.one, many: e.many },
    scopes: [
      { id: "major-elective", label: e.one },
      { id: "gened", label: "Gen ed" },
      { id: "free", label: "Free elective" },
      { id: "all", label: "All courses" },
    ],
    recordStatus: (code) => statuses.get(code) ?? null,
    buildRows: (plan) => buildRows(plan, student),
    prerequisiteGroups: (code, plan) => prerequisiteGroups(code, plan, finished, completed),
  };
}

const CATALOGS = new Map<ProgramCode, Catalog>();

export function catalogFor(program: ProgramCode = DEFAULT_PROGRAM): Catalog {
  let catalog = CATALOGS.get(program);
  if (!catalog) {
    catalog = buildCatalog(program);
    CATALOGS.set(program, catalog);
  }
  return catalog;
}

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
