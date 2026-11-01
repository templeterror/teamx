"use client";

import Link from "next/link";
import { useState } from "react";
import "../../components/plan/plan.css";

const oldTerms = ["Fall 2026", "Spring 2026", "Fall 2025"];

export function TermPicker() {
  const [open, setOpen] = useState(false);

  return (
    <div className="plan">
      <main className="gate wide">
        <p className="kicker">Rafiat Amir</p>
        <h1>Select a term</h1>
        <p className="meta">Spring 2027 is open for planning.</p>
        <article className="row core term-card">
          <div>
            <p className="code">Open</p>
            <h2 className="title">Spring 2027</h2>
          </div>
          <Link className="btn primary" href="/plan">
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
            {oldTerms.map((term) => (
              <Link key={term} href={`/plan?term=${encodeURIComponent(term)}`}>
                {term}
                <span className="meta"> Closed</span>
              </Link>
            ))}
          </div>
        ) : null}
      </main>
    </div>
  );
}
