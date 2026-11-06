import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";
import "./../components/plan/plan.css";

export const metadata: Metadata = {
  title: "Sign in · Course Planner",
};

/*
 * A mock sign-in. The one real choice is whose profile to open: Rafiat (her Computer
 * Science audit) or Allegra (a new Management Information Systems student). Continue
 * keeps it in a cookie (chooseProfile), so every page after this renders that person;
 * the top bar can switch later.
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
        <SignInForm />
      </main>
    </div>
  );
}
