import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CURRENT_TERM, closedTerm, closedTerms } from "@/components/plan/terms";
import "../../../components/plan/plan.css";

export function generateStaticParams() {
  return closedTerms.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/term/[slug]">): Promise<Metadata> {
  const term = closedTerm((await params).slug);
  return { title: `${term?.name ?? "Term"} · Course Planner` };
}

/*
 * A closed term is a record. No search, no Add or Drop: there is nothing here
 * to change, so the page offers nothing that looks like it could.
 */
export default async function ClosedTermPage({ params }: PageProps<"/term/[slug]">) {
  const { slug } = await params;
  const term = closedTerm(slug);
  if (!term) notFound();

  return (
    <div className="plan">
      <main className="gate wide">
        <p className="plan-topbar-brand">
          <b aria-hidden="true">T</b>
          <span>Course Planner</span>
        </p>
        <Link className="back-link" href="/term">
          ← All terms
        </Link>
        <h1>{term.name}</h1>
        <p className="meta">
          Completed · view only. A sample record from the bulletin&rsquo;s suggested plan, not your
          transcript.
        </p>
        <section className="record" aria-label={`${term.name} courses`}>
          <ul>
            {term.rows.map((row, i) => (
              <li key={`${row.code ?? row.title}-${i}`}>
                <div>
                  {row.code && <strong>{row.code}</strong>}
                  <span>{row.title}</span>
                </div>
                <span className="record-credits">{row.credits} cr</span>
              </li>
            ))}
          </ul>
          <footer>
            <span>{term.rows.length} courses</span>
            <span className="record-credits">{term.credits} credits</span>
          </footer>
        </section>
        <Link className="btn-primary" href="/plan">
          Go to {CURRENT_TERM} plan
        </Link>
      </main>
    </div>
  );
}
