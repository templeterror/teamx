/*
 * What onboarding shows, derived from the profile's record and program. Pure, no React.
 * Nothing here is invented: every fact comes from the DARS record (data/*student-record.json),
 * the program tree, or arithmetic on them (graduationProgress).
 */
import { programs, type AuditOpenItem, type RecordStatus } from "@/data";
import { graduationProgress } from "@/components/progress/progress";
import type { Profile } from "@/components/student/student";
import {
  nextFall,
  parseTerm,
  previousRegularTerm,
  regularTermsBetween,
  shiftRegularTerm,
  summersBetween,
  termIndex,
  termLabel,
  type Term,
} from "./terms";

export type ProgramFacts = {
  /* "Management Information Systems · BBA" */
  label: string;
  /* "Fox School of Business and Management" */
  college: string;
  catalogYear: string | null;
  /* The minor on the audit, if any. */
  recordMinor: string | null;
  /* "Junior", from earned credits; "First year" for a new student; null with no record to read. */
  standing: string | null;
  earned: number;
};

export type TermRow = { term: string; status: RecordStatus; credits: number; courses: number };

export type Totals = { required: number; earned: number; inProgress: number; toGo: number };

/*
 * Temple class standing by earned credits: freshman under 30, sophomore 30–59,
 * junior 60–89, senior 90 and up.
 */
export function classStanding(earned: number) {
  if (earned >= 90) return "Senior";
  if (earned >= 60) return "Junior";
  if (earned >= 30) return "Sophomore";
  return "Freshman";
}

/* The record's credits against the degree's; a new student's are all to go. */
export function totalsFor(profile: Profile): Totals | null {
  const { record } = profile;
  if (!record.audit && record.terms.length === 0 && !profile.isNew) return null;
  const { totalCredits } = graduationProgress(profile.program, record, []);
  return {
    required: totalCredits.required,
    earned: totalCredits.done,
    inProgress: totalCredits.inProgress,
    toGo: totalCredits.missing,
  };
}

export function programFacts(profile: Profile): ProgramFacts {
  const program = programs[profile.program].degree.program as { college?: string };
  const totals = totalsFor(profile);
  const earned = totals?.earned ?? 0;
  return {
    label: profile.programLabel,
    college: program.college ?? "",
    catalogYear: profile.record.catalogYear,
    recordMinor: profile.record.minor,
    standing: profile.isNew ? "First year" : totals ? classStanding(earned) : null,
    earned,
  };
}

export function termRows(profile: Profile): TermRow[] {
  return profile.record.terms.map((t) => ({
    term: t.term,
    status: t.status,
    credits: t.courses.reduce((sum, c) => sum + c.credits, 0),
    courses: t.courses.length,
  }));
}

/* "5 November 2026", read from the record's source line; null when it does not say. */
export function auditDate(profile: Profile): string | null {
  const match = /prepared (\d{1,2} [A-Z][a-z]+ \d{4})/.exec(profile.record.source);
  return match ? match[1] : null;
}

/* The audit's open items; minor items only while the plan keeps the minor. */
export function openItems(profile: Profile, keepMinor: boolean): AuditOpenItem[] {
  const open = profile.record.audit?.open ?? [];
  return keepMinor ? open : open.filter((item) => item.track !== "minor");
}

export function minorItemCount(profile: Profile) {
  return (profile.record.audit?.open ?? []).filter((item) => item.track === "minor").length;
}

/* ---------- Pace ---------- */

/*
 * The last term on the record. A new student has none: the term before the one they
 * start (Fall 2026 before Spring 2027, Summer 2027 before Fall 2027, as the board counts),
 * or the spring before the next fall when no start is known.
 */
export function lastRecordTerm(profile: Profile, start: string | null = null): Term {
  const terms = profile.record.terms
    .map((t) => parseTerm(t.term))
    .filter((t): t is Term => t !== null)
    .sort((a, b) => termIndex(a) - termIndex(b));
  const first = start ? parseTerm(start) : null;
  if (!terms.length && first) return first.season === "Fall" ? { season: "Summer", year: first.year } : previousRegularTerm(first);
  return terms.at(-1) ?? previousRegularTerm(nextFall(new Date()));
}

/* The first fall or spring term on the record, else the new student's start, else the next fall. */
function firstRegularTerm(profile: Profile, start: string | null): Term {
  for (const t of profile.record.terms) {
    const term = parseTerm(t.term);
    if (term && term.season !== "Summer") return term;
  }
  return (start && parseTerm(start)) || nextFall(new Date());
}

export type GraduationOption = { term: string; termsTotal: number; isDefault: boolean };

/* One term earlier than the default, the default, and two later; never one already on the record. */
export function graduationOptions(profile: Profile, defaultTerm: string, start: string | null = null): GraduationOption[] {
  const base = parseTerm(defaultTerm);
  if (!base) return [];
  const first = firstRegularTerm(profile, start);
  const last = lastRecordTerm(profile, start);
  return [-1, 0, 1, 2]
    .map((offset) => shiftRegularTerm(base, offset))
    .filter((term) => termIndex(term) > termIndex(last))
    .map((term) => ({
      term: termLabel(term),
      /* Fall and spring terms from the first one through this one. */
      termsTotal: regularTermsBetween(previousRegularTerm(first), term).length,
      isDefault: termLabel(term) === defaultTerm,
    }));
}

export type PaceCheck = {
  tone: "ok" | "warning";
  /* One sentence: "28 credits over 2 terms ≈ 14 per term — fits 15." */
  text: string;
  /* A second sentence when there is something to add. */
  detail?: string;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/*
 * The arithmetic behind "will this fit": credits still to place (graduationProgress) over
 * the fall and spring terms after the record, through the target, plus summers if used.
 */
export function paceCheck(
  profile: Profile,
  totals: Totals | null,
  graduationTerm: string,
  creditsPerTerm: number,
  summers: boolean,
  start: string | null = null,
): PaceCheck {
  const target = parseTerm(graduationTerm);
  const after = lastRecordTerm(profile, start);
  const toGo = totals?.toGo ?? 0;
  if (!target) return { tone: "warning", text: "Pick a graduation term." };
  if (totals && toGo === 0) {
    return { tone: "ok", text: `Your record covers all ${totals.required} credits.` };
  }

  const regular = regularTermsBetween(after, target);
  const summerTerms = summers ? summersBetween(after, target) : [];
  const termsText = plural(regular.length, "term");

  if (!totals) {
    return { tone: "ok", text: `${termsText} to ${graduationTerm} at ${creditsPerTerm} credits a term.` };
  }
  if (regular.length === 0 && summerTerms.length === 0) {
    return {
      tone: "warning",
      text: `${termLabel(after)} is your last term on file, so ${toGo} credits have nowhere to go.`,
      detail: "Pick a later term.",
    };
  }

  const perTerm = regular.length ? Math.ceil(toGo / regular.length) : Infinity;
  if (perTerm <= creditsPerTerm) {
    const text = `${toGo} credits over ${termsText} ≈ ${perTerm} per term — fits ${creditsPerTerm}.`;
    /* Lighter than the chosen load: say when that load would finish instead. */
    const termsNeeded = Math.ceil(toGo / creditsPerTerm);
    if (termsNeeded < regular.length) {
      return {
        tone: "ok",
        text,
        detail: `At ${creditsPerTerm} a term you could finish in ${termLabel(regular[termsNeeded - 1])}.`,
      };
    }
    return { tone: "ok", text };
  }

  /* More than the fall and spring terms hold at this load: summers take the rest, if used. */
  const overflow = toGo - regular.length * creditsPerTerm;
  if (summerTerms.length > 0 && Math.ceil(overflow / summerTerms.length) <= creditsPerTerm) {
    const where = summerTerms.length === 1 ? termLabel(summerTerms[0]) : plural(summerTerms.length, "summer");
    return {
      tone: "ok",
      text: regular.length
        ? `${toGo} credits: ${termsText} at ${creditsPerTerm} leaves ${overflow} for ${where}.`
        : `${toGo} credits, all in ${where}.`,
    };
  }

  return {
    tone: "warning",
    text:
      regular.length > 1
        ? `${toGo} credits over ${termsText} ≈ ${perTerm} per term — more than ${creditsPerTerm}.`
        : regular.length === 1
          ? `${toGo} credits in 1 term — more than ${creditsPerTerm}.`
          : `${toGo} credits won’t fit before ${graduationTerm}.`,
    detail: summers
      ? "Take more credits a term or pick a later term."
      : "Take more credits a term, use summers, or pick a later term.",
  };
}
