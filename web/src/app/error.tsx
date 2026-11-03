"use client";

import Link from "next/link";
import { useEffect } from "react";
import "./../components/plan/plan.css";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") console.error(error);
  }, [error]);

  return (
    <div className="plan">
      <main className="gate">
        <p className="plan-topbar-brand">
          <b aria-hidden="true">T</b>
          <span>Course Planner</span>
        </p>
        <h1>Something went wrong on this page</h1>
        <p className="meta">Your plan is still here. Try again, or go back to it.</p>
        <button type="button" className="btn primary" onClick={reset}>
          Try again
        </button>{" "}
        <Link className="btn text" href="/plan">
          Back to your plan
        </Link>
      </main>
    </div>
  );
}
