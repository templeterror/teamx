import type { Metadata } from "next";
import Link from "next/link";
import "./../components/plan/plan.css";

export const metadata: Metadata = {
  title: "Page not found · Course Planner",
};

export default function NotFound() {
  return (
    <div className="plan">
      <main className="gate">
        <p className="plan-topbar-brand">
          <b aria-hidden="true">T</b>
          <span>Course Planner</span>
        </p>
        <h1>There&rsquo;s nothing at this address</h1>
        <p className="meta">The page may have moved when the plan changed.</p>
        <Link className="btn primary" href="/plan">
          Go to your plan
        </Link>
      </main>
    </div>
  );
}
