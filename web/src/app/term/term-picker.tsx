"use client";

import Link from "next/link";
import { useState } from "react";
import "../../components/plan/plan.css";
import { closedTerms } from "../../components/plan/terms";

export function TermPicker() {
  const [open, setOpen] = useState(false);

  return (
    <div className="plan">
      <main className="gate wide">
        <p className="plan-topbar-brand">
          <b aria-hidden="true">T</b>
          <span>Course Planner</span>
        </p>
        <h1>Select a term</h1>
        <p className="meta">Spring 2027 is open for planning.</p>
        <article className="row core term-card">
          <h2 className="title">Spring 2027</h2>
          <Link className="btn-primary" href="/plan">
            Open plan
          </Link>
        </article>
        <button
          type="button"
          className="btn text"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Hide old terms" : "Look at old terms"}
        </button>
        {open ? (
          <div className="old-terms">
            {closedTerms.map((term) => (
              <Link key={term.slug} href={`/term/${term.slug}`}>
                {term.name}
                <span className="meta"> Completed · view only</span>
              </Link>
            ))}
          </div>
        ) : null}
      </main>
    </div>
  );
}
