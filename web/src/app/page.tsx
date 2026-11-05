import type { Metadata } from "next";
import { DEFAULT_PROGRAM } from "@/data";
import { chooseProgram } from "@/components/student/actions";
import { STUDENT_CHOICES } from "@/components/student/student";
import "./../components/plan/plan.css";

export const metadata: Metadata = {
  title: "Sign in · Course Planner",
};

/*
 * A mock sign-in. The one real choice is whose record to open: Rafiat's Computer Science
 * audit or a new Management Information Systems student. Continue keeps it in a cookie
 * (chooseProgram), so every page after this renders that student. Like any sign-in it
 * starts on the default, Rafiat, rather than reading the last choice back: the page stays
 * static and no saved choice can swap in under the pointer.
 */
export default function LoginPage() {
  return (
    <div className="plan">
      <main className="gate">
        <p className="plan-topbar-brand">
          <b aria-hidden="true">T</b>
          <span>Course Planner</span>
        </p>
        <h1>Sign in</h1>
        <form className="gate-form" action={chooseProgram}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              defaultValue="rafiat@temple.edu"
              autoComplete="username"
              spellCheck={false}
              readOnly
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" defaultValue="password" readOnly />
          </label>
          <ProgramField />
          <button type="submit" className="btn-primary">
            Continue
          </button>
        </form>
      </main>
    </div>
  );
}

/*
 * Two radios rather than a select: "Management Information Systems · BBA" and what
 * stands behind it do not fit a 440px select without truncating, and two choices read
 * best side by side anyway. Each row is a real label around its radio.
 */
function ProgramField() {
  return (
    <fieldset className="gate-choice">
      <legend>Program</legend>
      {STUDENT_CHOICES.map((s) => (
        <label key={s.program}>
          <input type="radio" name="program" value={s.program} defaultChecked={s.program === DEFAULT_PROGRAM} />
          <span>
            {s.programLabel}
            <small>{s.recordNote}</small>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
