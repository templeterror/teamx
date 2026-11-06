"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { programs, type ProgramCode } from "@/data";
import { chooseNewStudentProgram } from "@/components/student/actions";
import { NEW_STUDENT_PROGRAMS, profileFor, profileKey, type ProfileKey } from "@/components/student/student";
import {
  auditDate,
  graduationOptions,
  minorItemCount,
  openItems,
  paceCheck,
  programFacts,
  termRows,
  totalsFor,
  type PaceCheck,
} from "./onboarding-model";
import {
  START_TERMS,
  defaultPreferences,
  fourYearsFrom,
  savePreferences,
  usePreferences,
  type PlanPreferences,
} from "./preferences";
import "./onboarding.css";

/*
 * Plan setup: four short steps after sign-in that end on the four-year plan. The record
 * already says most of it (program, catalog year, minor, every term), so the flow shows
 * that and asks only what the audit cannot know: when to finish, how heavy a term, and
 * whether summers count. Nothing is saved until "Build my four-year plan"; "Skip for now"
 * leaves without saving.
 *
 * A new student has no record to confirm, so the flow asks instead: Program picks the
 * major (CS or MIS, kept in a cookie so the server renders it) and the first term, and
 * the Record step is skipped, since a step that only says "nothing yet" adds a click
 * and no information. No minor is offered: minors come from an audit, and neither
 * program's data has one of its own.
 */

const ALL_STEPS = [
  { id: "program", label: "Program" },
  { id: "record", label: "Record" },
  { id: "pace", label: "Pace" },
  { id: "ready", label: "Ready" },
] as const;

type StepId = (typeof ALL_STEPS)[number]["id"];

const CREDIT_CHOICES = [12, 13, 14, 15, 16, 17, 18];
const NO_MINOR = "none";

const STATUS_LABEL = { completed: "Completed", "in-progress": "In progress", registered: "Registered" } as const;

/* "First term" choices: the term open now, and the fall after it. */
const START_NOTES = ["The term open for planning now", "Start in the fall instead"];

export function Onboarding({ signedIn }: { signedIn: ProfileKey }) {
  const isNew = profileFor(signedIn).isNew;
  /* The new student's major, here first so the choice shows at once; the cookie follows (chooseProgram). */
  const [program, setProgram] = useState<ProgramCode>(profileFor(signedIn).program);
  const profileId: ProfileKey = isNew ? profileKey("new", program) : signedIn;
  const profile = profileFor(profileId);
  const STEPS = isNew ? ALL_STEPS.filter((s) => s.id !== "record") : ALL_STEPS;
  const indexOf = (id: StepId) => STEPS.findIndex((s) => s.id === id);
  const router = useRouter();
  const saved = usePreferences(profileId);
  const defaults = defaultPreferences(profileId);
  /* Only what was changed here; everything else reads through to what is saved. */
  const [draft, setDraft] = useState<Partial<PlanPreferences>>({});
  const prefs: PlanPreferences = { ...saved, ...draft };
  /* The default goal follows the first term: four years from whichever the student picks. */
  const defaultGraduation = prefs.startTerm ? fourYearsFrom(prefs.startTerm) : defaults.graduationTerm;
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [moved, setMoved] = useState(false);
  const [building, startBuilding] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const editing = saved.completedAt !== null;
  const facts = programFacts(profile);
  const totals = totalsFor(profile);
  const pace = paceCheck(profile, totals, prefs.graduationTerm, prefs.creditsPerTerm, prefs.summers, prefs.startTerm);
  const [, startSaving] = useTransition();

  function update(change: Partial<PlanPreferences>) {
    setDraft((d) => ({ ...d, ...change }));
  }

  /* Sets the program cookie; the server re-renders this page as that program's new student, in place. */
  function chooseProgram(code: ProgramCode) {
    setProgram(code);
    startSaving(() => chooseNewStudentProgram(code));
  }

  function goTo(index: number) {
    setMoved(true);
    setStep(index);
    setReached((r) => Math.max(r, index));
  }

  /* A new step: put focus on its heading so a screen reader starts there, and the page at the top. */
  useEffect(() => {
    if (!moved) return;
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [step, moved]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step < STEPS.length - 1) {
      goTo(step + 1);
      return;
    }
    startBuilding(async () => {
      if (isNew) await chooseNewStudentProgram(program);
      savePreferences(profileId, { ...prefs, completedAt: new Date().toISOString() });
      router.push("/four-year");
    });
  }

  const heading = (text: string) => (
    <h1 ref={headingRef} tabIndex={-1} className="onb-heading">
      {text}
    </h1>
  );

  let body: ReactNode;
  switch (STEPS[step].id) {
    case "program":
      body = isNew ? (
        <>
          {heading("Your program")}
          <p className="intro">
            No courses yet, so we start from your degree’s requirements. Pick your major and your first term.
          </p>
          <fieldset className="gate-choice onb-choice">
            <legend>Major</legend>
            {NEW_STUDENT_PROGRAMS.map((code) => {
              const college = (programs[code].degree.program as { college?: string }).college;
              return (
                <label key={code}>
                  <input
                    type="radio"
                    name="program"
                    value={code}
                    checked={program === code}
                    onChange={() => chooseProgram(code)}
                  />
                  <span>
                    {keepDegreeTogether(profileFor(profileKey("new", code)).programLabel)}
                    {college && <small>{college}</small>}
                  </span>
                </label>
              );
            })}
          </fieldset>
          <fieldset className="gate-choice onb-choice onb-grid">
            <legend>First term</legend>
            {START_TERMS.map((term, i) => (
              <label key={term}>
                <input
                  type="radio"
                  name="start"
                  value={term}
                  checked={prefs.startTerm === term}
                  onChange={() => update({ startTerm: term, graduationTerm: fourYearsFrom(term) })}
                />
                <span>
                  {term}
                  <small>{START_NOTES[i]}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <dl className="onb-facts">
            <div>
              <dt>Catalog year</dt>
              <dd>
                {facts.catalogYear}
                <small>The bulletin you start under</small>
              </dd>
            </div>
            <div>
              <dt>Class standing</dt>
              <dd>
                {facts.standing}
                <small className="onb-num">{facts.earned} credits earned</small>
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <>
          {heading("Your program")}
          <p className="intro">From your degree audit. Check it, and change your minor if that has changed.</p>
          <dl className="onb-facts">
            <div>
              <dt>Program</dt>
              <dd>
                {facts.label}
                {facts.college && <small>{facts.college}</small>}
              </dd>
            </div>
            <div>
              <dt>Catalog year</dt>
              <dd>{facts.catalogYear ?? "Not on your audit"}</dd>
            </div>
            <div>
              <dt>Class standing</dt>
              <dd>
                {facts.standing ?? "No credits on file yet"}
                {facts.standing && <small className="onb-num">{facts.earned} credits earned</small>}
              </dd>
            </div>
          </dl>
          {facts.recordMinor ? (
            <fieldset className="gate-choice onb-choice">
              <legend>Minor</legend>
              <label>
                <input
                  type="radio"
                  name="minor"
                  value={facts.recordMinor}
                  checked={prefs.minor === facts.recordMinor}
                  onChange={() => update({ minor: facts.recordMinor })}
                />
                <span>
                  {facts.recordMinor}
                  <small>On your degree audit</small>
                </span>
              </label>
              <label>
                <input
                  type="radio"
                  name="minor"
                  value={NO_MINOR}
                  checked={prefs.minor === null}
                  onChange={() => update({ minor: null })}
                />
                <span>
                  No minor
                  <small>Plan without the {facts.recordMinor} minor</small>
                </span>
              </label>
            </fieldset>
          ) : (
            <p className="onb-note">No minor on your audit.</p>
          )}
        </>
      );
      break;

    case "record":
      body = <RecordStep profileKey={profileId} keepMinor={prefs.minor !== null} heading={heading} />;
      break;

    case "pace":
      body = (
        <>
          {heading("Your pace")}
          <p className="intro">
            {isNew
              ? "Pick what you’re aiming for; you can change it later."
              : "The audit can’t know these. Pick what you’re aiming for; you can change it later."}
          </p>
          <fieldset className="gate-choice onb-choice onb-grid">
            <legend>Graduate by</legend>
            {graduationOptions(profile, defaultGraduation, prefs.startTerm).map((option) => (
              <label key={option.term}>
                <input
                  type="radio"
                  name="graduation"
                  value={option.term}
                  checked={prefs.graduationTerm === option.term}
                  onChange={() => update({ graduationTerm: option.term })}
                />
                <span>
                  {option.term}
                  <small className="onb-num">
                    {option.termsTotal} terms{option.termsTotal === 8 ? ", four years" : ""}
                  </small>
                </span>
              </label>
            ))}
          </fieldset>
          <CreditsControl value={prefs.creditsPerTerm} onChange={(creditsPerTerm) => update({ creditsPerTerm })} />
          <fieldset className="gate-choice onb-choice">
            <legend>Summers</legend>
            <label>
              <input
                type="checkbox"
                name="summers"
                checked={prefs.summers}
                onChange={(e) => update({ summers: e.target.checked })}
              />
              <span>
                Use summer terms
                <small>Summer courses can count toward what’s left</small>
              </span>
            </label>
          </fieldset>
          <PaceLine pace={pace} live />
        </>
      );
      break;

    case "ready":
      body = (
        <>
          {heading(editing ? "Your plan setup" : "Ready to build your plan")}
          <p className="intro">
            Your four-year plan starts from {isNew ? "your degree’s requirements" : "your record"} and these
            choices. Change them any time from your name in the top bar.
          </p>
          <dl className="onb-facts onb-summary">
            {isNew ? (
              <>
                <SummaryRow label="Program" onChange={() => goTo(indexOf("program"))} changeLabel="Change program">
                  {keepDegreeTogether(facts.label)}
                </SummaryRow>
                <SummaryRow label="First term" onChange={() => goTo(indexOf("program"))} changeLabel="Change first term">
                  {prefs.startTerm}
                </SummaryRow>
                <SummaryRow label="Minor">No minor</SummaryRow>
              </>
            ) : (
              <>
                <SummaryRow label="Program">{keepDegreeTogether(facts.label)}</SummaryRow>
                <SummaryRow label="Minor" onChange={() => goTo(indexOf("program"))} changeLabel="Change minor">
                  {prefs.minor ?? "No minor"}
                </SummaryRow>
              </>
            )}
            <SummaryRow label="Graduate by" onChange={() => goTo(indexOf("pace"))} changeLabel="Change graduation term">
              {prefs.graduationTerm}
            </SummaryRow>
            <SummaryRow label="Credits per term" onChange={() => goTo(indexOf("pace"))} changeLabel="Change credits per term">
              <span className="onb-num">{prefs.creditsPerTerm}</span>
            </SummaryRow>
            <SummaryRow label="Summers" onChange={() => goTo(indexOf("pace"))} changeLabel="Change summers">
              {prefs.summers ? "Used" : "Not used"}
            </SummaryRow>
          </dl>
          <PaceLine pace={pace} />
        </>
      );
      break;
  }

  const last = step === STEPS.length - 1;

  return (
    <main className="gate wide onb">
      <div className="onb-top">
        <p className="plan-topbar-brand">
          <b aria-hidden="true">T</b>
          <span>Course Planner</span>
        </p>
        <Link href="/four-year" className="onb-skip">
          {editing ? "Back to plan" : "Skip for now"}
        </Link>
      </div>

      <nav aria-label="Plan setup">
        <ol className="onb-steps">
          {STEPS.map((s, i) => {
            const state = i === step ? "current" : i < step ? "done" : "todo";
            const label = (
              <>
                <span className="onb-step-bar" aria-hidden="true" />
                <span className="onb-step-label">
                  <span className="onb-num">{i + 1}</span> {s.label}
                </span>
              </>
            );
            return (
              <li key={s.id} data-state={state}>
                {i <= reached && i !== step ? (
                  <button type="button" className="onb-step" onClick={() => goTo(i)}>
                    {label}
                  </button>
                ) : (
                  <span className="onb-step" aria-current={i === step ? "step" : undefined}>
                    {label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <form className="onb-form" onSubmit={onSubmit}>
        <section key={step} className="onb-body" data-enter={moved || undefined}>
          {body}
        </section>
        <div className="onb-actions">
          {step > 0 && (
            <button type="button" className="btn empty" onClick={() => goTo(step - 1)}>
              Back
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={building}>
            {last ? (building ? "Building your plan…" : editing ? "Save and open my plan" : "Build my four-year plan") : "Continue"}
          </button>
        </div>
      </form>
    </main>
  );
}

function RecordStep({
  profileKey,
  keepMinor,
  heading,
}: {
  profileKey: ProfileKey;
  keepMinor: boolean;
  heading: (text: string) => ReactNode;
}) {
  const profile = profileFor(profileKey);
  const rows = termRows(profile);
  const totals = totalsFor(profile);
  const open = openItems(profile, keepMinor);
  const hiddenMinor = keepMinor ? 0 : minorItemCount(profile);
  const date = auditDate(profile);

  return (
    <>
      {heading("Your record")}
      <p className="intro">We read your degree audit. This is what it shows.</p>

      {rows.length === 0 ? (
        <p className="onb-empty">No courses on file yet.</p>
      ) : (
        <>
          {totals && (
            <div className="onb-totals">
              <p className="onb-num">
                <strong>{totals.earned}</strong> earned · <strong>{totals.inProgress}</strong> in progress ·{" "}
                <strong>{totals.toGo}</strong> to go <span>of {totals.required} credits</span>
              </p>
              <div className="onb-meter" aria-hidden="true">
                <span data-part="earned" style={{ flexGrow: totals.earned }} />
                <span data-part="progress" style={{ flexGrow: totals.inProgress }} />
                <span data-part="to-go" style={{ flexGrow: totals.toGo }} />
              </div>
            </div>
          )}
          <table className="onb-terms">
            <caption className="onb-sr">Terms on your record</caption>
            <thead>
              <tr>
                <th scope="col">Term</th>
                <th scope="col">Status</th>
                <th scope="col">Credits</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.term}>
                  <th scope="row">{row.term}</th>
                  <td data-status={row.status}>{STATUS_LABEL[row.status]}</td>
                  <td className="onb-num">{row.credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {open.length > 0 && (
        <div className="onb-open">
          <h2>Still open</h2>
          <ul>
            {open.map((item, i) => (
              <li key={`${item.label}-${i}`}>
                <span>{item.label}</span>
                <span className="onb-num">{item.needs}</span>
              </li>
            ))}
          </ul>
          {hiddenMinor > 0 && (
            <p className="onb-note">
              {hiddenMinor === 1 ? "1 minor item" : `${hiddenMinor} minor items`} left out, since you chose No minor.
            </p>
          )}
        </div>
      )}

      <p className="onb-source">
        From your DARS audit{date ? `, prepared ${date}` : ""}. Your advisor still signs off on your plan.
      </p>
    </>
  );
}

/* Seven choices, 12 to 18, as one radio group: arrow keys move between them. */
function CreditsControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const hintId = useId();
  return (
    <fieldset className="onb-credits" aria-describedby={hintId}>
      <legend>Credits per term</legend>
      <div className="onb-segments">
        {CREDIT_CHOICES.map((n) => (
          <label key={n}>
            <input type="radio" name="credits" value={n} checked={value === n} onChange={() => onChange(n)} />
            <span className="onb-num">{n}</span>
          </label>
        ))}
      </div>
      <p id={hintId} className="onb-hint">
        Full-time is 12 or more. Over 18 needs approval.
      </p>
    </fieldset>
  );
}

function PaceLine({ pace, live = false }: { pace: PaceCheck; live?: boolean }) {
  return (
    <p className="onb-pace" data-tone={pace.tone} role={live ? "status" : undefined}>
      <span className="onb-num">{pace.text}</span>
      {pace.detail && <span>{pace.detail}</span>}
    </p>
  );
}

/* "Management Information Systems · BBA": non-breaking spaces keep "Systems · BBA" on one line. */
function keepDegreeTogether(label: string) {
  return label.replace(" · ", "\u00a0·\u00a0");
}

function SummaryRow({
  label,
  children,
  onChange,
  changeLabel,
}: {
  label: string;
  children: ReactNode;
  /* Left out where the value comes from the record and cannot change here. */
  onChange?: () => void;
  changeLabel?: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
      {onChange && (
        <dd className="onb-change">
          <button type="button" className="onb-link" onClick={onChange} aria-label={changeLabel}>
            Change
          </button>
        </dd>
      )}
    </div>
  );
}
