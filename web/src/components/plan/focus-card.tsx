"use client";

import { useState } from "react";
import { formatMeetings, type usePlan } from "./use-plan";

type IconName = "add" | "drop" | "chevron" | "check";
function Icon({ name }: { name: IconName }) {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "chevron" ? <path d="m6 4 4 4-4 4" /> : name === "check" ? <path d="m3 8 3 3 7-7" /> : <><path d="M4 8h8" />{name === "add" && <path d="M8 4v8" />}</>}
  </svg>;
}

export function FocusCard({ plan }: { plan: ReturnType<typeof usePlan> }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  return <div className="focus-card">
    <header><div><strong>Your semester</strong><p>{plan.placements.filter(item => !item.deferred).length} courses in your plan</p></div><span>{plan.credits}<small>credits</small></span></header>
    <div className="focus-card-scroll" data-expanded={selected !== null || undefined}>
      {plan.placements.map(item => <article className="focus-course-item" key={item.id} data-expanded={selected === item.id || undefined}><div className={`focus-course-row course-${item.kind}`} data-selected={selected === item.id || undefined} data-dropped={item.deferred || undefined}>
        <button className="focus-course-select" aria-expanded={selected === item.id} aria-controls={`focus-course-detail-${item.id}`} onClick={() => setSelected(selected === item.id ? null : item.id)}>
          <span className="focus-course-copy"><span className="focus-course-eyebrow"><strong>{item.course.code}</strong><span className={`course-status ${item.deferred ? "unplanned" : "planned"}`}><Icon name={item.deferred ? "drop" : "check"} />{item.deferred ? "Not in plan" : "In plan"}</span></span><span className="focus-course-title">{item.course.title}</span><span className="focus-course-meta">{item.course.credits} credits · {item.kind === "core" ? "Required" : item.kind === "gened" ? "Gen ed" : "Elective"}</span></span><span className="focus-chevron"><Icon name="chevron" /></span>
        </button>
        <div className="course-action-wrap"><button className={`course-action ${item.deferred ? "add" : "drop"}`} aria-label={`${item.deferred ? "Add" : "Drop"} ${item.course.code}`} title={`${item.deferred ? "Add to" : "Drop from"} plan`} onClick={() => { plan.toggleCourse(item); setAnnouncement(`${item.course.code} ${item.deferred ? "added to" : "dropped from"} your plan.`); }}><Icon name={item.deferred ? "add" : "drop"} /></button><span className="course-action-tip" aria-hidden="true">{item.deferred ? "Add to plan" : "Drop course"}</span></div>
      </div>
      {selected === item.id && <section id={`focus-course-detail-${item.id}`} className="focus-course-detail" aria-label={`${item.course.code} details`}>
        <p className="focus-meeting">{formatMeetings(item.course)}</p>{(item.deferred || item.options.length === 0) && <p>{item.deferred ? "This course is off your plan. Use the add icon to put it back." : item.course.why}</p>}{plan.conflictsFor(item.id).length > 0 && <p className="warn">Time conflict with {plan.conflictsFor(item.id).map(p => p.course.code).join(", ")}.</p>}{item.options.filter(o => o.code !== item.course.code).length > 0 && <p className="focus-detail-label">Suggested alternatives</p>}{item.options.filter(o => o.code !== item.course.code).map(option => <button className="focus-alternative" key={option.code} onClick={() => { item.pick(option.code); setAnnouncement(`Changed ${item.course.code} to ${option.code}.`); }}><span><small>{option.code}</small><strong>{option.title}</strong><small>{formatMeetings(option)} · {option.credits} credits</small></span><span>Swap →</span></button>)}
        {item.defer && !item.deferred && <button className="focus-defer" onClick={() => { item.defer?.(); setAnnouncement(`${item.course.code} moved to a later term.`); }}>Take it later <span aria-hidden="true">→</span></button>}
        {item.restore && item.deferred && <button className="focus-defer" onClick={() => { plan.toggleCourse(item); setAnnouncement(`${item.course.code} returned to this term.`); }}>Return to this term <span aria-hidden="true">→</span></button>}
      </section>}
      </article>)}

    </div>
    <footer aria-live="polite">{announcement || "Changes update your week. Registration happens in Banner."}</footer>
  </div>;
}
