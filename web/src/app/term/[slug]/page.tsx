import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { programs, type ProgramCode } from "@/data";
import { CURRENT_TERM, closedTerm, closedTerms, termStatusLabel } from "@/components/plan/terms";
import { currentProgram } from "@/components/student/profile-cookie";
import "../../../components/plan/plan.css";

/* Every student's closed terms. Which one a visitor may see is decided per request, from the cookie. */
const ALL_CLOSED = (Object.keys(programs) as ProgramCode[]).flatMap((code) => closedTerms(code));

export function generateStaticParams() {
  return [...new Set(ALL_CLOSED.map((t) => t.slug))].map((slug) => ({ slug }));
}

/*
 * Per request too, from the same cookie as the page: another profile's term is not
 * found, so its name stays out of the tab title as well as the page.
 */
export async function generateMetadata({ params }: PageProps<"/term/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const term = closedTerm(await currentProgram(), slug);
  return { title: term ? `${term.name} · Course Planner` : "Page not found · Course Planner" };
}

/*
 * A past or in-progress term is a record. No search, no Add or Drop: there is
 * nothing here to change, so the page offers nothing that looks like it could.
 */
export default function ClosedTermPage({ params }: PageProps<"/term/[slug]">) {
  return (
    <Suspense fallback={null}>
      <ResolvedTerm params={params} />
    </Suspense>
  );
}

/* Only the signed-in student's own record: another student's term is not found. */
async function ResolvedTerm({ params }: Pick<PageProps<"/term/[slug]">, "params">) {
  const { slug } = await params;
  const term = closedTerm(await currentProgram(), slug);
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
        <p className="meta">{termStatusLabel(term)} · view only. From your degree audit.</p>
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
