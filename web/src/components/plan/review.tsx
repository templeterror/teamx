"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { sections } from "@/data";
import { Legend, MeetingTime, Week, type Link as WeekLink } from "@/components/schedule-pair/schedule-pair";
import { ProgressPanel } from "@/components/four-year/progress-panel";
import { useGraduation } from "@/components/four-year/use-graduation";
import "@/components/four-year/four-year.css";
import { useProfile } from "@/components/student/student-context";
import { usePlanContext } from "./plan-shell";
import { CURRENT_TERM } from "./terms";
import type { Placement } from "./use-plan";
import { usePlanKinds } from "./week-plan";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/* "November 6, 2026", read on the client only (the server's clock and timezone can differ). */
const noSubscribe = () => () => {};
const today = () => new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/* The rail is a summary here: nothing on this page to scroll to. */
const ignore = () => {};

/*
 * The last step before Banner, and the page a student hands an advisor (on screen, or
 * saved as a PDF from the browser's print dialog). The week, the courses and graduation
 * progress, read-only, built from the same pieces as /plan and /four-year.
 *   not confirmed: a problem (under 12 credits, over 18, overlapping classes), suggestions,
 *                  or drops waiting on Confirm plan. Back to your plan is the action.
 *   confirmed:     the registration summary with sections. Save as PDF is the action.
 */
export function Review() {
  const plan = usePlanContext();
  const profile = useProfile();
  const { kindFor } = usePlanKinds();
  const { program, record, board, progress } = useGraduation();
  const generated = useSyncExternalStore(noSubscribe, today, () => "");

  /* Hovering or clicking a class lights its card, and the other way round. Nothing changes the plan. */
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const link: WeekLink = {
    selected,
    hovered,
    selectedFrom: "week",
    select: (id) => setSelected((current) => (current === id ? null : id)),
    hover: setHovered,
  };

  const active = plan.placements.filter((p) => !p.deferred);
  const suggested = active.filter((p) => !plan.confirmed[p.id]);
  const settled = active.filter((p) => plan.confirmed[p.id]);
  const off = plan.placements.filter((p) => p.deferred);
  const ready = plan.planConfirmed;

  /* The browser names the saved PDF after the page title: "Spring 2027 plan – Rafiat Amir". */
  const fileTitle = `${CURRENT_TERM} plan – ${profile.name}`;
  useEffect(() => {
    let previous: string | null = null;
    const before = () => {
      if (document.title === fileTitle) return;
      previous = document.title;
      document.title = fileTitle;
    };
    const after = () => {
      if (previous !== null) document.title = previous;
      previous = null;
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
      after();
    };
  }, [fileTitle]);

  const savePdf = () => {
    const previous = document.title;
    document.title = fileTitle;
    window.print();
    document.title = previous;
  };

  const status = ready
    ? "No time conflicts. Planning doesn’t register you: register for these sections in Banner."
    : active.length === 0
      ? "Your plan has no courses yet."
      : plan.problems.length > 0
        ? `Fix ${plan.problems.length === 1 ? "this" : "these"} on your plan before you register.`
        : suggested.length > 0
          ? `${suggested.length} of ${active.length} courses ${suggested.length === 1 ? "is still a suggestion" : "are still suggestions"}. Confirm your plan to register.`
          : `You dropped ${plan.pendingDrops.map((p) => p.course.code).join(", ")}. Confirm your plan to remove ${plan.pendingDrops.length === 1 ? "it" : "them"}.`;

  const backLink = (
    <Link className={ready ? "fy-link" : "btn-primary"} href="/plan">
      Back to your plan
    </Link>
  );
  const pdfButton = active.length > 0 && (
    <button type="button" className={ready ? "btn-primary" : "btn empty"} onClick={savePdf}>
      Save as PDF
    </button>
  );

  return (
    <div className="rv" data-ready={ready || undefined}>
      <header className="workspace-heading rv-heading">
        <div>
          <p className="eyebrow rv-screen">{CURRENT_TERM} / Review &amp; register</p>
          <p className="eyebrow rv-print">Course Planner · Temple University</p>
          <h1>
            <span className="rv-screen">{ready ? "Ready to register" : "Confirm your plan first"}</span>
            <span className="rv-print">{CURRENT_TERM} plan</span>
          </h1>
          <p className="rv-print rv-who">
            {profile.name} · {profile.programLabel}
            {generated && <> · Generated {generated}</>}
          </p>
          <p className="intro rv-status">
            {!ready && active.length > 0 && <span className="rv-draft">Draft · </span>}
            {status}
          </p>
        </div>
        <div className="rv-actions">
          {ready ? <>{backLink}{pdfButton}</> : <>{pdfButton}{backLink}</>}
        </div>
      </header>

      {plan.problems.length > 0 && (
        <section className="review-blockers" aria-labelledby="review-blockers">
          <h2 id="review-blockers" className="fy-sr">
            Fix before confirming
          </h2>
          <ul>
            {plan.problems.map((p) => (
              <li key={p.key}>
                <span className="review-blocker-icon" aria-hidden="true">
                  !
                </span>
                <p>{p.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="fy-layout rv-layout">
        <div className="sp rv-main">
          <section className="rv-week" aria-labelledby="rv-week">
            <div className="sp-toolbar">
              <h2 id="rv-week">Weekly schedule</h2>
              <span>{plan.credits} credits</span>
            </div>
            <div className="sp-calendar">
              <Week plan={plan} confirmed={plan.confirmed} link={link} previewing={null} kindOf={kindFor} />
            </div>
            <div className="rv-legend">
              <Legend free={active.some((p) => kindFor(p) === "free-elective")} />
              {suggested.length > 0 && (
                <span className="sp-legend-item rv-legend-suggested">
                  <i className="rv-swatch-suggested" aria-hidden="true" />
                  Suggested, not confirmed
                </span>
              )}
            </div>
          </section>

          <section className="rv-courses" aria-labelledby="rv-courses">
            <div className="sp-toolbar">
              <h2 id="rv-courses">{ready ? "Register for these" : "Your courses"}</h2>
              <span>
                {ready
                  ? `${plural(active.length, "section")} · ${plan.credits} credits`
                  : `${suggested.length} suggested · ${settled.length} confirmed`}
              </span>
            </div>
            {active.length === 0 && off.length === 0 ? (
              <p className="rv-empty">
                Nothing to review yet. <Link href="/find">Find courses</Link> to start your {CURRENT_TERM} plan.
              </p>
            ) : ready ? (
              <CardList items={active} link={link} kindFor={kindFor} showSection />
            ) : (
              <>
                {suggested.length > 0 && (
                  <Group title="Still suggested" note="Confirm or change these on your plan">
                    <CardList items={suggested} link={link} kindFor={kindFor} />
                  </Group>
                )}
                {settled.length > 0 && (
                  <Group title="Confirmed">
                    <CardList items={settled} link={link} kindFor={kindFor} />
                  </Group>
                )}
              </>
            )}
            {off.length > 0 && (
              <Group title="Not this term">
                <CardList items={off} link={link} kindFor={kindFor} />
              </Group>
            )}
          </section>
        </div>

        <aside className="fy fy-rail rv-rail" aria-label="Graduation progress">
          <p className="eyebrow rv-print">Graduation progress · {profile.programLabel}</p>
          <ProgressPanel
            program={program}
            minor={record.minor}
            progress={progress}
            goal={board.goal}
            board={board}
            onShowRequirement={ignore}
            onShowCard={ignore}
          />
        </aside>
      </div>

      <p className="rv-print rv-foot">
        Draft plan from Course Planner — confirm with your advisor. Section numbers and meeting times are sample data,
        not Temple’s schedule.
      </p>
    </div>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="rv-group">
      <h3>
        {title}
        {note && <span> · {note}</span>}
      </h3>
      {children}
    </div>
  );
}

/* The /plan course card, read-only: code and credits in the kind's ink, title, meeting time. */
function CardList({
  items,
  link,
  kindFor,
  showSection = false,
}: {
  items: Placement[];
  link: WeekLink;
  kindFor: (p: Placement) => Placement["kind"];
  showSection?: boolean;
}) {
  return (
    <ul className="rv-cards">
      {items.map((item) => {
        const section = showSection ? sections.find((s) => s.course === item.course.code) : undefined;
        const lit = link.hovered === item.id || link.selected === item.id;
        return (
          <li
            key={item.id}
            className={`sp-ccard rv-card sp-${kindFor(item)}`}
            data-linked={lit || undefined}
            data-dropped={item.deferred || undefined}
            onPointerEnter={() => link.hover(item.id)}
            onPointerLeave={() => link.hover(null)}
          >
            <span className="sp-ccard-top">
              <span className="sp-ccard-code">
                {item.course.code} · {plural(item.course.credits, "credit")}
              </span>
              {item.deferred && <span className="sp-ccard-status">{item.dropped ? "Dropped" : "Later term"}</span>}
            </span>
            <span className="sp-ccard-title">{item.course.title}</span>
            <MeetingTime course={item.course} />
            {section && <span className="sp-ccard-meta rv-section">Section {section.section}</span>}
          </li>
        );
      })}
    </ul>
  );
}
