import type { Metadata } from "next";
import Link from "next/link";
import "./../components/plan/plan.css";

export const metadata: Metadata = {
  title: "Sign in · Course Planner",
};

export default function LoginPage() {
  return (
    <div className="plan">
      <main className="gate">
        <p className="plan-topbar-brand">
          <b aria-hidden="true">T</b>
          <span>Course Planner</span>
        </p>
        <h1>Sign in</h1>
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
        <Link className="btn-primary" href="/term">
          Continue
        </Link>
      </main>
    </div>
  );
}
