"use client";

import Link from "next/link";
import { useState } from "react";
import "../../components/plan/plan.css";
import { CURRENT_TERM, termStatusLabel, type ClosedTerm } from "../../components/plan/terms";

export function TermPicker({ closedTerms }: { closedTerms: ClosedTerm[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="plan">
      <main className="gate wide">
        <p className="plan-topbar-brand">
          <b aria-hidden="true">T</b>
          <span>Course Planner</span>
        </p>
        <h1>Select a term</h1>
        <p className="meta">{CURRENT_TERM} is open for planning.</p>
        <article className="row core term-card">
          <h2 className="title">{CURRENT_TERM}</h2>
          <Link className="btn-primary" href="/plan">
            Open plan
          </Link>
        </article>
        {/* A new student has no old terms, so there is nothing to look at. */}
        {closedTerms.length > 0 && (
          <button
            type="button"
            className="btn text"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Hide old terms" : "Look at old terms"}
          </button>
        )}
        {open && closedTerms.length > 0 ? (
          <div className="old-terms">
            {closedTerms.map((term) => (
              <Link key={term.slug} href={`/term/${term.slug}`}>
                {term.name}
                <span className="meta"> {termStatusLabel(term)} · view only</span>
              </Link>
            ))}
          </div>
        ) : null}
      </main>
    </div>
  );
}
