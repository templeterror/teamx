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
        <p className="kicker">Course Planner</p>
        <h1>Sign in</h1>
        <p className="meta">A static sign-in. Nothing here is checked.</p>
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
        <Link className="btn primary" href="/term">
          Continue
        </Link>
      </main>
    </div>
  );
}
