"use client";

import { DAY_END, DAY_START, type Day } from "./data";
import { formatMeetings, type Placement, type usePlan } from "./use-plan";

type Plan = ReturnType<typeof usePlan>;

const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HOUR = 72;

export function Header({
  plan,
  term = "Spring 2027",
}: {
  plan: Plan;
  term?: string;
}) {
  const closed = term !== "Spring 2027";
  return (
    <header className="top">
      <div>
        <p className="kicker">{term}</p>
        <h1>Your plan</h1>
        <p className={plan.over ? "meta warn" : "meta"}>
          {plan.credits} credits
          {plan.over
            ? ` · ${plan.over} over the 18 credit max`
            : " · 9 elective credits still open in the degree"}
        </p>
        {closed ? <p className="meta">Closed term. The week below is the Spring 2027 plan.</p> : null}
        {plan.kept ? <p className="kept">Plan kept.</p> : null}
      </div>
      <button
        type="button"
        className="btn primary"
        onClick={plan.keep}
        disabled={plan.kept}
      >
        {plan.kept ? "Plan kept" : "Keep this plan"}
      </button>
    </header>
  );
}

export function CourseRow({ item, plan }: { item: Placement; plan: Plan }) {
  const clashes = plan.conflictsFor(item.id);
  const alternatives = item.options.filter(
    (option) => option.code !== item.course.code,
  );
  return (
    <article className={`row course-${item.kind}${item.dotted ? " open" : ""}`}>
      <div className="row-head">
        <div>
          <p className="code">
            {item.deferred ? "Later term" : item.course.code}
            {item.kind === "elective" ? " · Elective" : ""}
            {item.kind === "gened" ? " · Gen ed" : ""}
          </p>
          <h2 className="title">{item.course.title}</h2>
        </div>
        <p className="credits">
          {item.deferred ? "0" : item.course.credits} credits
        </p>
      </div>
      <p className="why">
        {item.deferred
          ? "Moved off this term. The slot it held can take another elective."
          : item.course.why}{" "}
        {item.deferred ? "" : formatMeetings(item.course)}
      </p>
      {clashes.length ? (
        <p className="why" style={{ color: "var(--warning)" }}>
          Overlaps {clashes.map((clash) => clash.course.code).join(", ")}.
        </p>
      ) : null}
      {alternatives.length ? (
        <div className="alts">
          <p className="alts-label">Instead</p>
          {alternatives.map((option) => (
            <button
              key={option.code}
              type="button"
              className="alt"
              aria-label={`Swap to ${option.code} ${option.title}, ${formatMeetings(option)}, ${option.credits} credits`}
              onClick={() => item.pick(option.code)}
            >
              <span className="alt-head">
                <span className="alt-code">{option.code}</span>
                <span className="alt-action">Swap</span>
              </span>
              <span className="alt-title">{option.title}</span>
              <span className="alt-meta">
                {formatMeetings(option)}
                <span> · {option.credits} credits</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {item.defer && !item.deferred ? (
        <div className="choices">
          <button type="button" className="btn text" onClick={item.defer}>
            Take it later
          </button>
        </div>
      ) : null}
      {item.restore && item.deferred ? (
        <div className="choices">
          <button type="button" className="btn text" onClick={item.restore}>
            Put it back this term
          </button>
        </div>
      ) : null}
    </article>
  );
}

export function WeekBoard({ plan }: { plan: Plan }) {
  const hours = [];
  for (let minute = DAY_START; minute < DAY_END; minute += 60) {
    const h = Math.floor(minute / 60);
    hours.push(h > 12 ? h - 12 : h);
  }

  return (
    <div className="week panel" aria-label="Week of classes">
      <div className="hour-spacer" />
      {DAYS.map((day) => (
        <p key={day} className="day-name">
          {day}
        </p>
      ))}
      <div className="hour-col">
        {hours.map((hour) => (
          <p key={hour} className="hour">
            {hour}
          </p>
        ))}
      </div>
      {DAYS.map((day) => {
        const blocks = plan.placements.filter(
          (item) => !item.deferred && item.course.days.includes(day),
        );
        return (
          <div key={day} className="day">
            {blocks.map((item) => {
              const clashes = plan.conflictsFor(item.id);
              const lane = blocks
                .filter(
                  (block) =>
                    block.id === item.id ||
                    clashes.some((clash) => clash.id === block.id),
                )
                .findIndex((block) => block.id === item.id);
              const top = ((item.course.start - DAY_START) / 60) * HOUR;
              const height =
                ((item.course.end - item.course.start) / 60) * HOUR;
              const width = clashes.length ? "calc(50% - 6px)" : "calc(100% - 8px)";
              const left = clashes.length && lane > 0 ? "calc(50% + 2px)" : "4px";
              return (
                <div
                  key={item.id}
                  className={
                    `block course-${item.kind}` +
                    (item.dotted ? " open" : "") +
                    (clashes.length ? " clash" : "")
                  }
                  style={{ top, height, width, left }}
                  title={`${item.course.code} ${item.course.title}`}
                  data-full-label={`${item.course.code} · ${item.course.title}`}
                  aria-label={`${item.course.code} ${item.course.title}, ${formatMeetings(item.course)}`}
                  tabIndex={0}
                >
                  <p className="code">{item.course.code}</p>
                  <p className="name">{item.course.title}</p>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function Decisions({ plan }: { plan: Plan }) {
  const open = plan.placements.filter(
    (item) => item.dotted || item.defer || item.restore,
  );
  return (
    <div className="aside">
      {open.map((item) => (
        <CourseRow key={item.id} item={item} plan={plan} />
      ))}
    </div>
  );
}
