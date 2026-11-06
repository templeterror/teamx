/*
 * How close a student is to graduating: their record (data/*student-record.json, a real
 * DARS audit) plus the courses placed on the four-year board. Pure, no React.
 *
 * The audit decides what is still open: `audit.open` is authoritative, and every other
 * requirement in the program tree counts as met by the record. Record courses are
 * attributed to requirements from `audit.applied` where the audit lists them, else by the
 * tree (named courses, gen ed areas, elective lists), so the UI can say what satisfied what.
 *
 * Placed courses fill the open items: a course named in an item's `from`, or matching its
 * `pool` ("MKTG 3***"), fills it. A course counts toward one requirement only, except that
 * a minor course may also count as a Fox business elective (see mis-program.json
 * needsReview "minor-business-elective-overlap"). Free electives absorb whatever is left.
 */
import { courses, programs, type AuditOpenItem, type ProgramCode, type StudentRecord } from "@/data";

/* A future, not-yet-taken placement from the board. `term` is "Fall 2027". `slot` is the openSlots id the card stands in, if any. */
export type PlacedCourse = { code: string; credits: number; term: string; slot?: string };

export type RequirementStatus = "met" | "in-progress" | "planned" | "missing";

export type SatisfiedBy = {
  code: string;
  term: string;
  state: "completed" | "in-progress" | "registered" | "planned";
};

export type RequirementProgress = {
  /* mis-program.json / program.json node id, "minor", or another track ("honors"). */
  id: string;
  group: "gened" | "foundation" | "major" | "electives" | "minor" | "university";
  /* Student-facing: "Upper-division foundation". */
  label: string;
  required: { credits: number; courses?: number };
  /* Credits. */
  done: number;
  inProgress: number;
  planned: number;
  status: RequirementStatus;
  /* Credits still unplaced, after the board's placements. */
  missingCredits: number;
  /* What is still unplaced. */
  missing: { label: string; from?: string[]; pool?: string[]; credits: number }[];
  satisfiedBy: SatisfiedBy[];
  /* The audit's or tree's caveat, when there is one ("Waived by STAT 2103"). */
  note?: string;
};

export type GraduationProgress = {
  totalCredits: { required: number; done: number; inProgress: number; planned: number; missing: number };
  requirements: RequirementProgress[];
  /* Every requirement covered and credits at least the degree minimum. */
  onTrack: boolean;
  /* The last term holding a placed course when on track, else null. */
  graduationTerm: string | null;
  /* "On track to graduate Spring 2028" / "28 credits and 7 requirements still unplaced". */
  summary: string;
};

export type SlotKind = "core" | "elective" | "gened" | "free-elective";

export type OpenSlot = {
  /* Stable: "<requirement>#<item>.<n>". Pass it back as PlacedCourse.slot. */
  id: string;
  /* The requirement row id (node id or "minor"). */
  requirement: string;
  /* "Business elective (1 of 3)" */
  label: string;
  kind: SlotKind;
  credits: number;
  /* Courses in courses.json that fill the slot; options[0] is the default. Empty for a free elective with no suggestion. */
  options: string[];
  /* Subject/level patterns that also fill it ("MKTG 3***"). */
  pool?: string[];
};

/* ---------- Catalog and tree ---------- */

type CourseCard = {
  title: string;
  credits: { value?: number; min?: number; max?: number; options?: number[] };
  genEdAreas: string[];
  attributes?: string[];
  restrictions?: Record<string, string>;
};
const CATALOG = courses as unknown as Record<string, CourseCard>;

function catalogCredits(code: string): number | undefined {
  const credits = CATALOG[code]?.credits;
  if (!credits) return undefined;
  /* A lab science lists [0, 4]: 0 is the lab section on its own, 4 the course. */
  return credits.value ?? credits.min ?? (credits.options ? Math.max(...credits.options) : undefined);
}

type Credits = number | { min: number; max: number };
type TreeNode = {
  id?: string;
  title?: string;
  kind: string;
  code?: string;
  credits?: Credits;
  count?: number;
  courses?: string[];
  attribute?: string;
  waivedBy?: string[];
  waivedByRequirement?: string;
  pool?: { kind: string; subject: string; from: string; to: string }[];
  options?: unknown;
  note?: string;
  children?: TreeNode[];
};

const minCredits = (credits: Credits | undefined) =>
  credits === undefined ? 0 : typeof credits === "number" ? credits : credits.min;

function treeOf(program: ProgramCode): TreeNode[] {
  return (programs[program].degree as unknown as { requirements: TreeNode[] }).requirements;
}

function programName(program: ProgramCode): string {
  return programs[program].degree.program.name;
}

/* Every course code a node names, sequences and lists included. */
function codesIn(value: unknown, into: string[] = []): string[] {
  if (typeof value === "string") {
    if (/^[A-Z]{2,5} \d{4}$/.test(value)) into.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) codesIn(item, into);
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) if (key !== "id" && key !== "source") codesIn(item, into);
  }
  return into;
}

/*
 * A leaf the tree names by course: a course or one-of node with no title of its own
 * (fox.lower-foundation.acct-2103 has an id for its transfer note, but is one of the
 * foundation's courses). A titled one (major.capstone) is a requirement of its own.
 */
const isLeaf = (node: TreeNode) => !node.title && (node.kind === "course" || node.kind === "oneOf");

function leafCodes(node: TreeNode): string[] {
  return node.kind === "course" && node.code ? [node.code] : node.courses ?? [];
}

/* ---------- Patterns ---------- */

/* "MKTG 3***", "ACCT 2000-3999" or an exact code. */
export function matchesPattern(code: string, pattern: string): boolean {
  const [subject, number] = code.split(" ");
  const [patternSubject, patternNumber = ""] = pattern.split(" ");
  if (subject !== patternSubject || !number) return false;
  const range = /^(\d{4})-(\d{4})$/.exec(patternNumber);
  if (range) return number >= range[1] && number <= range[2];
  return new RegExp(`^${patternNumber.replace(/\*/g, "\\d")}$`).test(number);
}

/* A tree subject range as patterns: 2000-3999 reads "ACCT 2***", "ACCT 3***". */
function rangePatterns(pool: NonNullable<TreeNode["pool"]>): string[] {
  return pool.flatMap(({ subject, from, to }) => {
    if (from.endsWith("000") && to.endsWith("999")) {
      const patterns: string[] = [];
      for (let digit = Number(from[0]); digit <= Number(to[0]); digit++) patterns.push(`${subject} ${digit}***`);
      return patterns;
    }
    return [`${subject} ${from}-${to}`];
  });
}

/* ---------- Terms ---------- */

const SEASONS: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2 };

/* Chronological sort key for "Fall 2027"; an unreadable term sorts last. */
export function termOrder(term: string): number {
  const match = /^(Spring|Summer|Fall) (\d{4})$/.exec(term);
  return match ? Number(match[2]) * 3 + SEASONS[match[1]] : Number.POSITIVE_INFINITY;
}

/* ---------- Rows ---------- */

type Group = RequirementProgress["group"];

type Need = {
  label: string;
  /* Singular, for a slot: "Business elective". */
  slotLabel: string;
  credits: number;
  courses?: number;
  from?: string[];
  pool?: string[];
  /* Only a placement in this need's own slot fills it (no course list to match against). */
  slotOnly: boolean;
  /*
   * Counts on top of other requirements (University Honors, upper-level credits): a course
   * that fills another requirement may fill this too, and a course placed here still counts
   * elsewhere.
   */
  overlay: boolean;
  /* An overlay's own test for a placed course (honors, upper-level), when it names no list. */
  accepts?: (code: string) => boolean;
  filled: { code: string; credits: number; term: string }[];
};

type Row = {
  id: string;
  group: Group;
  label: string;
  node?: TreeNode;
  required: { credits: number; courses?: number };
  /* Codes the tree names for this row (named courses, an area's or elective list). */
  codes: Set<string>;
  pool: string[];
  attribute?: string;
  satisfiedBy: SatisfiedBy[];
  needs: Need[];
  note?: string;
};

function groupOf(id: string): Group {
  if (id === "minor") return "minor";
  if (id.startsWith("gened.")) return "gened";
  if (id === "free-electives" || id === "fox.upper-foundation.business-electives") return "electives";
  if (id === "major" || id.startsWith("major.")) return "major";
  if (id.startsWith("fox.")) return "foundation";
  return "university";
}

function rowLabel(id: string, node: TreeNode | undefined, program: ProgramCode): string {
  if (id === "major" && node?.title?.startsWith(programName(program))) return "Major courses";
  return node?.title ?? id;
}

function makeRow(program: ProgramCode, id: string, node: TreeNode | undefined, leaves: TreeNode[]): Row {
  const named = leaves.flatMap(leafCodes);
  const required = leaves.length
    ? { credits: leaves.reduce((sum, leaf) => sum + minCredits(leaf.credits), 0), courses: leaves.length }
    : { credits: minCredits(node?.credits), ...(node?.count ? { courses: node.count } : {}) };
  const ownCodes = node && !leaves.length ? [...leafCodes(node), ...(node.courses ?? [])] : [];
  const listed = node?.kind === "oneSequence" ? codesIn(node.options) : [];
  return {
    id,
    group: groupOf(id),
    label: rowLabel(id, node, program),
    node,
    required,
    codes: new Set([...named, ...ownCodes, ...listed]),
    pool: node?.pool ? rangePatterns(node.pool) : [],
    attribute: node?.attribute,
    satisfiedBy: [],
    needs: [],
  };
}

/*
 * The rows a program reports, in tree order: each gen ed area, then every node with an id
 * whose own named courses (or credits) make a requirement. Zero-credit nodes (Fox Forward,
 * MIS professional development) and overlapping credit minimums (degree, residency,
 * writing intensive, college credits) are left out unless the audit lists them as open.
 */
function treeRows(program: ProgramCode, openIds: Set<string>): Row[] {
  const rows: Row[] = [];
  const visit = (node: TreeNode) => {
    if (node.id === "university") {
      const gened = node.children?.find((child) => child.id === "university.gened");
      for (const area of gened?.children ?? []) if (area.id) rows.push(makeRow(program, area.id, area, []));
      for (const child of node.children ?? []) {
        if (child.id && openIds.has(child.id)) rows.push({ ...makeRow(program, child.id, child, []), required: { credits: 0 } });
      }
      return;
    }
    if (!node.id) return;
    const children = node.children ?? [];
    const leaves = children.filter(isLeaf);
    const branches = children.filter((child) => child.id && !isLeaf(child));
    const zero = node.credits !== undefined && minCredits(node.credits) === 0;
    const overlay = node.kind === "creditMinimum" || node.kind === "pointsMinimum";
    if (!children.length) {
      if (overlay && openIds.has(node.id)) {
        /* Sized by what the audit says is still needed (step 4 of buildModel). */
        rows.push({ ...makeRow(program, node.id, node, []), required: { credits: 0 } });
      } else if (!zero && !overlay) {
        rows.push(makeRow(program, node.id, node, []));
      }
    } else if (leaves.length && !zero) {
      rows.push(makeRow(program, node.id, node, leaves));
    }
    branches.forEach(visit);
  };
  treeOf(program).forEach(visit);
  return rows;
}

/* The row an audit or exception requirement id lands in: itself, else its nearest row ancestor. */
function rowFor(rows: Row[], requirement: string): Row | undefined {
  const exact = rows.find((row) => row.id === requirement);
  if (exact) return exact;
  return rows
    .filter((row) => requirement.startsWith(`${row.id}.`))
    .sort((a, b) => b.id.length - a.id.length)[0];
}

function findNode(nodes: TreeNode[], id: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = node.children && findNode(node.children, id);
    if (hit) return hit;
  }
  return undefined;
}

/* ---------- Open items as needs ---------- */

const CODE = /[A-Z]{2,5} \d{4}/g;

/* One card's wording: "Business electives" reads "Business elective". */
function singular(label: string): string {
  return /(electives|courses)$/.test(label) ? label.slice(0, -1) : label;
}

function averageCredits(codes: string[] | undefined): number {
  const known = (codes ?? []).map(catalogCredits).filter((value): value is number => value !== undefined);
  return known.length ? Math.round(known.reduce((sum, value) => sum + value, 0) / known.length) : 3;
}

/*
 * An open item as one or more needs. A record that states `courses`/`credits` is read as
 * is (Allegra's). Otherwise the audit's wording is read loosely (Rafiat's): course codes
 * it names become one need each, "N credits" and "N courses" the rest.
 */
function needsFor(item: AuditOpenItem, row: Row): Need[] {
  const base = (label: string, extra: Partial<Need>): Need => ({
    label,
    slotLabel: singular(label),
    credits: 0,
    slotOnly: false,
    overlay: row.node?.kind === "creditMinimum" || (!!item.track && item.track !== "minor"),
    filled: [],
    ...extra,
  });
  const treeFrom = row.codes.size ? [...row.codes] : undefined;
  const treePool = row.pool.length ? row.pool : undefined;
  /* A need with no list of its own that an overlay rule can judge counts other courses, not just its card. */
  const rule = overlayRule(item, row);
  const ruled = (from?: string[], pool?: string[]): Partial<Need> =>
    rule && !from && !pool ? { accepts: rule, slotOnly: false } : {};

  if (item.credits !== undefined || item.courses !== undefined) {
    const from = item.from ?? (item.pool ? undefined : treeFrom);
    const pool = item.pool ?? (item.from ? undefined : treePool);
    const credits = item.credits ?? (item.courses ?? 1) * averageCredits(from);
    const slotOnly = !from && !pool && row.id !== "free-electives" && !row.attribute;
    return [base(item.label, { credits, courses: item.courses, from, pool, slotOnly, ...ruled(from, pool) })];
  }

  const text = item.needs;
  const named = item.from ? [] : (text.match(CODE) ?? []);
  const needs: Need[] = named.map((code) =>
    base(`${item.label}: ${code}`, { credits: catalogCredits(code) ?? 3, courses: 1, from: [code] }),
  );
  const creditMatch = /(\d+(?:\.\d+)?)\s+(?:[a-z]+\s+)?credits?/i.exec(text);
  const courseMatch = /(\d+)\s+(?:more\s+)?(?:[A-Za-z]+\s+)?courses?/i.exec(text) ?? /\((\d+) courses?\)/i.exec(text);
  const from = item.from ?? (named.length ? undefined : treeFrom);
  const pool = item.pool ?? (named.length || item.from ? undefined : treePool);
  const unconstrained = !from && !pool && row.id !== "free-electives" && !row.attribute;
  if (creditMatch) {
    needs.push(base(named.length ? `${item.label}: electives` : item.label, {
      credits: Number(creditMatch[1]), from, pool, slotOnly: unconstrained || named.length > 0, ...ruled(from, pool),
    }));
  } else if (courseMatch) {
    const count = Number(courseMatch[1]);
    const nodeCredits = row.node && minCredits(row.node.credits);
    const credits = !named.length && nodeCredits && row.satisfiedBy.length === 0 ? nodeCredits : count * averageCredits(from);
    needs.push(base(item.label, { credits, courses: count, from, pool, slotOnly: unconstrained || named.length > 0, ...ruled(from, pool) }));
  } else if (!named.length) {
    needs.push(base(item.label, { credits: averageCredits(from), courses: 1, from, pool, slotOnly: unconstrained, ...ruled(from, pool) }));
  }
  return needs;
}

/*
 * "Upper-level credits (2000+ in CLA, CST or ENGR)". courses.json has no college field, so the
 * colleges are read from subject codes. An assumption: these are the subjects in the catalog
 * that the College of Science and Technology, the College of Engineering and the College of
 * Liberal Arts offer. Fox (ECON, STAT, MIS…) and Tyler (DES, ART…) subjects are left out.
 */
const UPPER_LEVEL_ROW = "college.upper-level";
const UPPER_LEVEL_SUBJECTS = new Set([
  /* Science and Technology */
  "BIOL", "CHEM", "CIS", "EES", "MATH", "PHYS", "SCTC",
  /* Engineering */
  "BIOE", "CEE", "ECE", "ENGR", "ISE", "MEE",
  /* Liberal Arts */
  "AAAS", "AMST", "ANTH", "ARBC", "ASST", "CHI", "CJ", "ENG", "ENST", "FREN", "GER", "GRC", "GSWS",
  "GUS", "HIST", "ITAL", "JPNS", "JST", "LAS", "PHIL", "POLS", "PSY", "REL", "RUS", "SOC", "SPAN",
]);

const courseNumber = (code: string) => Number(code.split(" ")[1]);

/*
 * The test an overlay applies to placed courses, so a course that fills another requirement
 * counts here too: University Honors takes any honors course (the catalog's HO attribute) at
 * the level the audit states; upper-level credits take any 2000+ course in the colleges above.
 */
function overlayRule(item: AuditOpenItem, row: Row): ((code: string) => boolean) | undefined {
  if (row.id === UPPER_LEVEL_ROW) {
    return (code) => UPPER_LEVEL_SUBJECTS.has(code.split(" ")[0]) && courseNumber(code) >= 2000;
  }
  if (item.track === "honors") {
    const floor = Number(/(\d{4})\s*(?:\+|or above|and above)/i.exec(item.needs)?.[1] ?? 0);
    return (code) => !!CATALOG[code]?.attributes?.includes("HO") && courseNumber(code) >= floor;
  }
  return undefined;
}

const filledCredits = (need: Need) => need.filled.reduce((sum, course) => sum + course.credits, 0);
const isFilled = (need: Need) =>
  filledCredits(need) >= need.credits || (need.courses !== undefined && need.filled.length >= need.courses);

function needAccepts(need: Need, code: string): boolean {
  if (need.from?.includes(code)) return true;
  if (need.accepts?.(code)) return true;
  return (need.pool ?? []).some((pattern) => matchesPattern(code, pattern));
}

/* ---------- The model ---------- */

type RecordEntry = { code: string; credits: number; term: string; state: SatisfiedBy["state"]; order: number };

function recordEntries(record: StudentRecord): RecordEntry[] {
  return record.terms.flatMap((term) =>
    term.courses.map((course) => ({
      code: course.code,
      credits: course.credits,
      term: term.term,
      state: course.status ?? term.status,
      order: termOrder(term.term),
    })),
  );
}

const MINOR_OVERLAP_ROW = "fox.upper-foundation.business-electives";

function buildModel(program: ProgramCode, record: StudentRecord) {
  const tree = treeOf(program);
  const audit = record.audit;
  const open = audit?.open ?? [];
  const openIds = new Set(open.flatMap((item) => (item.requirement ? [item.requirement] : [])));
  const rows = treeRows(program, openIds);
  const entries = recordEntries(record).sort((a, b) => a.order - b.order);
  const byCode = new Map(entries.map((entry) => [entry.code, entry]));
  const attributed = new Set<string>();
  /* A waiver also leaves the course free to count where the tree names it (MATH 1041 in calculus). */
  const attribute = (row: Row, entry: RecordEntry, counts = true) => {
    if (row.satisfiedBy.some((item) => item.code === entry.code)) return;
    row.satisfiedBy.push({ code: entry.code, term: entry.term, state: entry.state });
    if (counts) attributed.add(entry.code);
  };

  /* 1. What the audit itself applied. */
  for (const applied of audit?.applied ?? []) {
    const row = rowFor(rows, applied.requirement);
    for (const code of applied.codes) {
      const entry = byCode.get(code);
      if (row && entry) attribute(row, entry);
    }
  }

  /* 2. Exceptions the audit made (MIS 2101 for MIS 1101), and waivers the tree states. */
  for (const exception of record.satisfiedByException) {
    const row = rowFor(rows, exception.requirement);
    const entry = exception.code ? byCode.get(exception.code) : undefined;
    if (!row) continue;
    if (entry) attribute(row, entry);
    if (!row.note) row.note = exception.note;
  }
  for (const row of rows) {
    const node = row.node;
    if (node?.kind !== "waivedBy") continue;
    const waiver = (node.waivedBy ?? []).map((code) => byCode.get(code)).find(Boolean);
    if (waiver) {
      attribute(row, waiver, false);
      row.note ??= `Waived by ${waiver.code}.`;
    } else if (node.waivedByRequirement) {
      row.note ??= "Waived by the major.";
    }
  }

  /* 3. The rest by the tree: named courses, then gen ed areas, then elective lists, then free electives. */
  const room = (row: Row) =>
    row.satisfiedBy.reduce((sum, item) => sum + (byCode.get(item.code)?.credits ?? 0), 0) < row.required.credits;
  for (const entry of entries) {
    if (attributed.has(entry.code)) continue;
    const areas = (CATALOG[entry.code]?.genEdAreas ?? []).map((area) => area.toUpperCase());
    const row = rows.find((candidate) => candidate.codes.has(entry.code) && candidate.node?.kind !== "waivedBy")
      ?? rows.find((candidate) => !!candidate.attribute && areas.includes(candidate.attribute) && room(candidate))
      ?? rows.find((candidate) => candidate.pool.some((pattern) => matchesPattern(entry.code, pattern)) && room(candidate))
      ?? rows.find((candidate) => candidate.id === "free-electives");
    if (row) attribute(row, entry);
  }

  /* 4. Open items. A track or an id with no row gets its own row. */
  for (const item of open) {
    const id = item.track ?? item.requirement ?? item.label;
    let row = item.track ? rows.find((candidate) => candidate.id === id) : rowFor(rows, id);
    if (!row) {
      const node = item.requirement ? findNode(tree, item.requirement) : undefined;
      row = makeRow(program, id, node, []);
      row.group = item.track ? (item.track === "minor" ? "minor" : "university") : groupOf(id);
      row.label = item.track === "minor" && record.minor ? `${record.minor} minor` : node?.title ?? item.label;
      row.required = { credits: 0 };
      rows.push(row);
    }
    const needs = needsFor(item, row);
    row.needs.push(...needs);
    if (item.note && !row.note) row.note = item.note;
    /* A row the tree does not size (a track, an overlay) is as big as what it still needs. */
    if (!row.node || row.node.kind === "creditMinimum") {
      row.required.credits += needs.reduce((sum, need) => sum + need.credits, 0);
      const courses = needs.reduce((sum, need) => sum + (need.courses ?? 0), 0);
      if (courses) row.required.courses = (row.required.courses ?? 0) + courses;
    }
  }

  /* 5. With no audit, whatever the record leaves short is open. */
  if (!audit) {
    for (const row of rows) {
      const have = row.satisfiedBy.reduce((sum, item) => sum + (byCode.get(item.code)?.credits ?? 0), 0);
      if (have >= row.required.credits || row.node?.waivedByRequirement) continue;
      const from = row.codes.size ? [...row.codes].filter((code) => !byCode.has(code)) : undefined;
      row.needs.push({
        label: row.label,
        slotLabel: row.label,
        credits: row.required.credits - have,
        from,
        pool: row.pool.length ? row.pool : undefined,
        slotOnly: false,
        overlay: false,
        filled: [],
      });
    }
  }

  return { rows, entries, byCode };
}

/* ---------- Slots ---------- */

/*
 * The default first choice for a slot, per program. MIS 3535 is the bulletin's highly
 * recommended business elective (its prerequisite, MIS 2101, is on Allegra's record);
 * MIS 3534 and MIS 3536 are MIS 3000-level electives whose cards list no prerequisite.
 * MKTG 3508 (Digital Marketing) and MKTG 3509 (Customer Data Analytics) sit closest to
 * an MIS major. ITAL 0868 (World Society) and ITAL 1002 follow her ITAL 1001.
 */
const DEFAULT_CHOICES: Record<ProgramCode, Record<string, string[]>> = {
  "BU-MIS-BBA": {
    "gened.gg": ["ITAL 0868"],
    [MINOR_OVERLAP_ROW]: ["MIS 3535", "MIS 3534", "MIS 3536"],
    minor: ["MKTG 3508", "MKTG 3509"],
    "free-electives": ["ITAL 1002"],
  },
  /*
   * Rafiat is in University Honors, which still wants 3 honors courses at 2000 or above, and
   * her IH I default is already the honors IH 0951. Honors General Physics I and II are a
   * lab science sequence the major lists, so they fill the sequence and two of the three
   * honors courses at once (and count as upper-level CST credits). MATH 2941 (Honors
   * Differential Equations I) is the third, the honors course closest to a CS degree.
   */
  "ST-CSCI-BS": {
    "major.lab-science": ["PHYS 2921", "PHYS 2922"],
    honors: ["MATH 2941", "MATH 2943"],
  },
};

function excludedFor(program: ProgramCode, code: string): boolean {
  const name = programName(program);
  return Object.values(CATALOG[code]?.restrictions ?? {}).some(
    (text) => text.startsWith("May not be enrolled") && text.includes(name),
  );
}

function slotKind(row: Row): SlotKind {
  if (row.id === "free-electives") return "free-elective";
  if (row.group === "gened") return "gened";
  if (row.group === "minor" || row.group === "university" || row.id === MINOR_OVERLAP_ROW) return "elective";
  if (row.node?.kind === "creditsFrom") return "elective";
  return "core";
}

function slotsFor(program: ProgramCode, model: ReturnType<typeof buildModel>): OpenSlot[] {
  const { rows, byCode } = model;
  const required = new Set(rows.flatMap((row) => (row.node?.kind === "creditsFrom" ? [] : [...row.codes])));
  const elsewhere = (self: Need) =>
    new Set(rows.flatMap((row) => row.needs.filter((need) => need !== self).flatMap((need) => need.from ?? [])));

  return rows.flatMap((row) =>
    row.needs.flatMap((need, needIndex): OpenSlot[] => {
      const taken = elsewhere(need);
      const listed = need.from
        ? need.from
        : need.accepts
          ? Object.keys(CATALOG).filter((code) => need.accepts!(code) && !required.has(code) && !taken.has(code))
        : row.attribute && !need.pool
          ? Object.keys(CATALOG).filter((code) => CATALOG[code].genEdAreas.map((a) => a.toUpperCase()).includes(row.attribute!))
          : need.pool
            ? Object.keys(CATALOG).filter((code) =>
                need.pool!.some((pattern) => matchesPattern(code, pattern)) && !required.has(code) && !taken.has(code))
            : [];
      const candidates = listed.filter((code) => code in CATALOG && !byCode.has(code) && !excludedFor(program, code));
      const defaults = (DEFAULT_CHOICES[program][row.id] ?? []).filter((code) =>
        need.from || need.pool || need.accepts || row.attribute ? candidates.includes(code) : code in CATALOG && !byCode.has(code));
      const ordered = [...defaults, ...candidates.filter((code) => !defaults.includes(code))];
      const count = need.courses ?? 1;
      const each = need.courses ? need.credits / need.courses : need.credits;
      return Array.from({ length: count }, (_, k) => {
        const first = ordered.length ? ordered[k % ordered.length] : undefined;
        return {
          id: `${row.id}#${needIndex}.${k}`,
          requirement: row.id,
          label: count > 1 ? `${need.slotLabel} (${k + 1} of ${count})` : need.slotLabel,
          kind: slotKind(row),
          credits: each,
          options: first ? [first, ...ordered.filter((code) => code !== first)] : [],
          ...(need.pool ? { pool: need.pool } : {}),
        };
      });
    }),
  );
}

/* The open items as board cards to place: one slot per course still needed. */
export function openSlots(program: ProgramCode, record: StudentRecord): OpenSlot[] {
  return slotsFor(program, buildModel(program, record));
}

/* ---------- Progress ---------- */

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function graduationProgress(
  program: ProgramCode,
  record: StudentRecord,
  placed: PlacedCourse[],
): GraduationProgress {
  const model = buildModel(program, record);
  const { rows, entries, byCode } = model;
  const needs = rows.flatMap((row) => row.needs.map((need, index) => ({ row, need, index })));

  /* Each code once, never one already on the record; in term order. */
  const seen = new Set<string>();
  const courses = placed
    .filter((course) => {
      if (byCode.has(course.code) || seen.has(course.code)) return false;
      seen.add(course.code);
      return true;
    })
    .sort((a, b) => termOrder(a.term) - termOrder(b.term));

  const used = new Map<string, Need>();
  const fill = (need: Need, course: PlacedCourse) => {
    need.filled.push({ code: course.code, credits: course.credits, term: course.term });
    used.set(course.code, need);
  };

  /* A card in its own slot fills that slot when the course fits it. */
  for (const course of courses) {
    if (!course.slot) continue;
    const [rowId, rest = ""] = course.slot.split("#");
    const target = needs.find(({ row, index }) => row.id === rowId && rest.startsWith(`${index}.`));
    if (target && !isFilled(target.need)) {
      const { need } = target;
      const fits = need.slotOnly || (!need.from && !need.pool) || needAccepts(need, course.code);
      if (fits && need.overlay) need.filled.push({ code: course.code, credits: course.credits, term: course.term });
      else if (fits) fill(need, course);
    }
  }
  /* Then named courses, then pools; slot-only needs (overlays) wait for their own cards. */
  const pass = (test: (need: Need, code: string) => boolean) => {
    for (const course of courses) {
      if (used.has(course.code)) continue;
      const target = needs.find(({ need }) => !need.slotOnly && !need.overlay && !isFilled(need) && test(need, course.code));
      if (target) fill(target.need, course);
    }
  };
  pass((need, code) => !!need.from?.includes(code));
  pass((need, code) => (need.pool ?? []).some((pattern) => matchesPattern(code, pattern)));

  /*
   * Overlays take any course they name or their rule accepts, wherever else it counts. Each
   * overlay row looks at every course, so honors physics counts toward University Honors and
   * upper-level credits both; only what no placed course covers is left for the overlay's cards.
   */
  for (const row of rows) {
    const overlays = row.needs.filter((need) => need.overlay);
    if (!overlays.length) continue;
    for (const course of courses) {
      if (overlays.some((need) => need.filled.some((item) => item.code === course.code))) continue;
      const target = overlays.find((need) => !isFilled(need) && needAccepts(need, course.code));
      if (target) target.filled.push({ code: course.code, credits: course.credits, term: course.term });
    }
  }

  /* A minor course may also be a Fox business elective (needsReview minor-business-elective-overlap). */
  const minorRow = rows.find((row) => row.id === "minor");
  const overlap = needs.filter(({ row }) => row.id === MINOR_OVERLAP_ROW);
  const overlapped = new Set<string>();
  for (const course of courses) {
    const holder = used.get(course.code);
    if (!holder || !minorRow?.needs.includes(holder)) continue;
    const target = overlap.find(({ need }) => !isFilled(need) && needAccepts(need, course.code));
    if (target) {
      target.need.filled.push({ code: course.code, credits: course.credits, term: course.term });
      overlapped.add(course.code);
    }
  }

  /* Free electives take whatever is left, past their need too. */
  const freeRow = rows.find((row) => row.id === "free-electives");
  const leftovers = courses.filter((course) => !used.has(course.code));
  const extraFree: PlacedCourse[] = [];
  for (const course of leftovers) {
    const target = freeRow?.needs.find((need) => !isFilled(need));
    if (target) fill(target, course);
    else extraFree.push(course);
  }
  /*
   * A minor is not a degree requirement, so a minor course no degree requirement used also
   * counts as a free elective, as DARS counts it (Allegra's fourth Marketing course). It stays
   * the minor's too; it only fills free-elective need that is still open.
   */
  for (const course of courses) {
    const holder = used.get(course.code);
    if (!holder || !minorRow?.needs.includes(holder) || overlapped.has(course.code)) continue;
    const target = freeRow?.needs.find((need) => !isFilled(need));
    if (target) target.filled.push({ code: course.code, credits: course.credits, term: course.term });
  }
  const overlapNote = overlapped.size && minorRow
    ? `Counted from your ${minorRow.label} courses — confirm with your advisor.`
    : undefined;

  const requirements: RequirementProgress[] = rows.map((row) => {
    const sum = (states: SatisfiedBy["state"][]) =>
      row.satisfiedBy
        .filter((item) => states.includes(item.state))
        .reduce((total, item) => total + (byCode.get(item.code)?.credits ?? 0), 0);
    const plannedCourses = [
      ...row.needs.flatMap((need) => need.filled),
      ...(row === freeRow ? extraFree.map(({ code, credits, term }) => ({ code, credits, term })) : []),
    ];
    const missing = row.needs.filter((need) => !isFilled(need)).map((need) => {
      const remaining = need.credits - filledCredits(need);
      return {
        label: need.label,
        ...(need.from ? { from: need.from } : {}),
        ...(need.pool ? { pool: need.pool } : {}),
        credits: need.courses !== undefined
          ? Math.max(remaining, 0) || (need.courses - need.filled.length) * (need.credits / need.courses)
          : Math.max(remaining, 0),
      };
    });
    const satisfiedBy: SatisfiedBy[] = [
      ...row.satisfiedBy,
      ...plannedCourses.map(({ code, term }) => ({ code, term, state: "planned" as const })),
    ];
    const status: RequirementStatus = row.needs.length
      ? missing.length ? "missing" : "planned"
      : row.satisfiedBy.some((item) => item.state !== "completed") ? "in-progress" : "met";
    return {
      id: row.id,
      group: row.group,
      label: row.label,
      required: row.required,
      done: sum(["completed"]),
      inProgress: sum(["in-progress", "registered"]),
      planned: plannedCourses.reduce((total, course) => total + course.credits, 0),
      status,
      missingCredits: missing.reduce((total, item) => total + item.credits, 0),
      missing,
      satisfiedBy,
      ...(row.id === MINOR_OVERLAP_ROW && overlapNote
        ? { note: overlapNote }
        : row.note ? { note: row.note } : {}),
    };
  });

  const done = entries.filter((entry) => entry.state === "completed").reduce((sum, entry) => sum + entry.credits, 0);
  const inProgress = entries.filter((entry) => entry.state !== "completed").reduce((sum, entry) => sum + entry.credits, 0);
  const planned = courses.reduce((sum, course) => sum + course.credits, 0);
  const required = record.audit?.credits.required
    ?? minCredits(findNode(treeOf(program), "university.credits")?.credits);
  const missingTotal = Math.max(required - done - inProgress - planned, 0);
  const open = requirements.filter((item) => item.status === "missing");
  const onTrack = open.length === 0 && missingTotal === 0;

  const lastPlaced = [...courses].sort((a, b) => termOrder(a.term) - termOrder(b.term)).at(-1)?.term;
  const lastRecord = entries.at(-1)?.term;
  const graduationTerm = onTrack ? lastPlaced ?? lastRecord ?? null : null;

  const parts = [
    ...(missingTotal ? [plural(missingTotal, "credit")] : []),
    ...(open.length ? [plural(open.length, "requirement")] : []),
  ];
  const summary = onTrack
    ? graduationTerm ? `On track to graduate ${graduationTerm}` : "On track to graduate"
    : `${parts.join(" and ")} still unplaced`;

  return {
    totalCredits: { required, done, inProgress, planned, missing: missingTotal },
    requirements,
    onTrack,
    graduationTerm,
    summary,
  };
}
