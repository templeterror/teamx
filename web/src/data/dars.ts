/*
 * A DARS degree audit, requirement by requirement, as the audit prints it: each record
 * JSON carries one under its `dars` key. Sections are the audit's own groupings
 * (General Education, Major, Minor...), each requirement a DARS code with its status,
 * the courses it applied and, for a requirement with sub-requirements, its parts.
 */

export type DarsStatus = "met" | "in-progress" | "needs";

export type DarsCourse = {
  /* "FL24", "SP27" */
  term: string;
  /* "CIS 2168" */
  code: string;
  credits: number;
  title: string;
  /* Currently taking or registered (no grade yet). */
  inProgress?: boolean;
  /* "IH 0852" when an honors twin stands in. */
  satisfies?: string;
};

export type DarsPart = {
  /* "Data Structures and Algorithms" */
  label: string;
  status: DarsStatus;
  /* "1 course", "6 credits" */
  needs?: string;
  courses?: DarsCourse[];
  /* Short human string, e.g. "CIS 4397 or 4398". */
  selectFrom?: string;
  note?: string;
};

export type DarsRequirement = {
  /* DARS code, e.g. "GENED-GW", "CISS.TBS". */
  id: string;
  /* Sentence case, e.g. "Analytic Reading and Writing". */
  title: string;
  status: DarsStatus;
  /* Met by an exception rather than a course. */
  byException?: boolean;
  summary?: { earned?: number; inProgress?: number; needs?: number; unit: "credits" | "courses" };
  needs?: string;
  /* Courses applied directly (no parts). */
  courses?: DarsCourse[];
  parts?: DarsPart[];
  /* What can fill it, when the requirement has no parts ("CLA, CST or ENGR 2000–4999"). */
  selectFrom?: string;
  note?: string;
};

export type DarsSection = { title: string; requirements: DarsRequirement[] };

export type DarsAudit = { prepared: string; catalog: string; program: string; sections: DarsSection[] };
