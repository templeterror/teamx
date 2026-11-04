"use client";

/*
 * Weekly schedule + Your courses, designed as one component.
 *
 * Rendered on /plan, and on /components in fixed states for design work.
 * Every class is `sp-` prefixed so it never collides with plan.css.
 * Courses shortlisted on /find arrive as suggestions with the reason line
 * "You shortlisted this"; Confirm plan removes every course that was dropped.
 *
 * Decision model: every course arrives as a suggestion. The student confirms
 * one at a time or all at once with "Confirm plan". Anything the student does
 * on purpose (swap, move later, add back) counts as a decision and confirms
 * that course. Confirmed courses can still be changed.
 */

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { CREDIT_MAX, CREDIT_MIN, DAY_END, DAY_START, type Day, type Offering } from "@/components/plan/data";
import { formatMeetings, planProblems, type PlanProblem, type Placement, type usePlan } from "@/components/plan/use-plan";
import { courses, sections } from "@/data";
import { BlockText, FitLine } from "./fit-text";
import "./schedule-pair.css";

export type PairPlan = Pick<
  ReturnType<typeof usePlan>,
  "placements" | "credits" | "conflictsFor" | "toggleCourse"
> &
  /* The live plan owns confirmation so review can read it; fixtures fall back to local state. */
  Partial<
    Pick<
      ReturnType<typeof usePlan>,
      "confirmed" | "setConfirmed" | "confirmPlan" | "planConfirmed" | "fromShortlist" | "problems"
    >
  >;

const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const KIND_LABEL: Record<Placement["kind"], string> = {
  core: "Required",
  elective: "Elective",
  gened: "Gen ed",
  "free-elective": "Free elective",
};

export type Confirmed = Record<string, boolean>;

export type PreviewTarget = { itemId: string; code: string };

/* A swap the student is looking at but has not committed to. */
export type Previewing = {
  item: Placement;
  alt: Offering;
  pinned: boolean;
  clashes: Placement[];
  credits: number;
};

type KindOf = (item: Placement) => Placement["kind"];
const ownKind: KindOf = (item) => item.kind;
const NONE: ReadonlySet<string> = new Set();

function overlaps(a: Offering, b: Offering) {
  return a.days.some((d) => b.days.includes(d)) && a.start < b.end && b.start < a.end;
}

/* What a change would leave blocking Confirm plan, said as one announcement. */
function problemsAfter(active: Placement[]) {
  return planProblems(active).map((p) => p.text).join(" ");
}

export function SchedulePair({
  plan,
  defaultExpanded = null,
  initialConfirmed = [],
  initialPreview = null,
  kindFor = ownKind,
  coursesAction,
}: {
  plan: PairPlan;
  defaultExpanded?: string | null;
  initialConfirmed?: readonly string[] | "all";
  initialPreview?: PreviewTarget | null;
  /* The colour category for a placement, when the host knows better than `item.kind`. */
  kindFor?: KindOf;
  /* Rendered in the Your courses toolbar, e.g. "Find courses". */
  coursesAction?: ReactNode;
}) {
  const id = useId();
  const [localConfirmed, setLocalConfirmed] = useState<Confirmed>(() =>
    Object.fromEntries(
      plan.placements
        .filter((p) => initialConfirmed === "all" || initialConfirmed.includes(p.id))
        .map((p) => [p.id, true]),
    ),
  );
  const confirmed = plan.confirmed ?? localConfirmed;
  const setConfirmed = plan.setConfirmed ?? setLocalConfirmed;
  const [announcement, setAnnouncement] = useState("");
  /* One selection shared by the week and the list: click either side, both respond. */
  const [selected, setSelected] = useState<string | null>(defaultExpanded);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selectedFrom, setSelectedFrom] = useState<"week" | "list" | null>(null);
  /*
   * Swap preview. Hovering an alternative peeks at it; clicking pins it so the
   * student can study the week before choosing Swap or Cancel.
   */
  const [pinned, setPinned] = useState<PreviewTarget | null>(initialPreview);
  const [peek, setPeek] = useState<PreviewTarget | null>(null);

  const link = {
    selected,
    hovered,
    selectedFrom,
    select(id: string | null, from: "week" | "list") {
      setSelected((current) => (current === id ? null : id));
      setSelectedFrom(from);
      setPinned(null);
      setPeek(null);
    },
    hover: setHovered,
  };

  const active = plan.placements.filter((item) => !item.deferred);
  const suggested = active.filter((item) => !confirmed[item.id]);
  /* The real plan, not a preview's: only what is in the plan can block Confirm plan. */
  const problems = plan.problems ?? planProblems(active);
  /* The live plan's answer also counts drops waiting on Confirm plan; fixtures never remove a drop. */
  const planConfirmed = plan.planConfirmed ?? (active.length > 0 && suggested.length === 0 && problems.length === 0);

  const target = pinned ?? peek;
  const targetItem = target ? active.find((p) => p.id === target.itemId) : undefined;
  const targetAlt = targetItem?.options.find((o) => o.code === target?.code);
  const previewing: Previewing | null =
    targetItem && targetAlt && targetAlt.code !== targetItem.course.code
      ? {
          item: targetItem,
          alt: targetAlt,
          pinned: pinned?.itemId === targetItem.id && pinned.code === targetAlt.code,
          clashes: active.filter((p) => p.id !== targetItem.id && overlaps(p.course, targetAlt)),
          credits: plan.credits - targetItem.course.credits + targetAlt.credits,
        }
      : null;

  const preview = {
    peek(itemId: string | null, code?: string) {
      setPeek(itemId && code ? { itemId, code } : null);
    },
    pin(item: Placement, option: Offering) {
      setPinned({ itemId: item.id, code: option.code });
      const clashes = active.filter((p) => p.id !== item.id && overlaps(p.course, option));
      setAnnouncement(
        `Previewing ${option.code} in your week. ${
          clashes.length
            ? `Overlaps ${clashes.map((c) => c.course.code).join(", ")}.`
            : "No time conflicts."
        }`,
      );
    },
    cancel() {
      setPinned(null);
      setPeek(null);
      setAnnouncement("Preview closed. Your plan did not change.");
    },
  };

  const decide = {
    /* Everything the student dropped leaves the plan; a course moved to a later term stays. */
    confirmAll() {
      if (problems.length) {
        setAnnouncement(problems.map((p) => p.text).join(" "));
        return;
      }
      const dropped = plan.placements.filter((p) => p.dropped);
      if (plan.confirmPlan) plan.confirmPlan();
      else setConfirmed((c) => ({ ...c, ...Object.fromEntries(active.map((p) => [p.id, true])) }));
      if (plan.confirmPlan && dropped.length) {
        setSelected((s) => (dropped.some((p) => p.id === s) ? null : s));
        setAnnouncement(`Plan confirmed. Removed ${dropped.length} dropped ${dropped.length === 1 ? "course" : "courses"}.`);
      } else setAnnouncement("Plan confirmed.");
    },
    /* Reopen a confirmed plan: everything goes back to being a suggestion. */
    editPlan() {
      setConfirmed({});
      setAnnouncement("Plan reopened. Confirm it again when you’re done.");
    },
    swap(item: Placement, code: string) {
      setPinned(null);
      setPeek(null);
      item.pick(code);
      setConfirmed((c) => ({ ...c, [item.id]: true }));
      const next = item.options.find((o) => o.code === code) ?? item.course;
      const after = problemsAfter(active.map((p) => (p.id === item.id ? { ...p, course: next } : p)));
      setAnnouncement(`Changed ${item.course.code} to ${code}. ${after || "Confirmed."}`);
    },
    /* Dropping from a confirmed plan reopens it; the card stays until Confirm plan. */
    remove(item: Placement) {
      plan.toggleCourse(item);
      const after = problemsAfter(active.filter((p) => p.id !== item.id));
      setAnnouncement(
        after
          ? `${item.course.code} dropped. ${after}`
          : planConfirmed
            ? `${item.course.code} dropped. Confirm your plan again to remove it.`
            : `${item.course.code} dropped from your plan.`,
      );
    },
    addBack(item: Placement) {
      plan.toggleCourse(item);
      setConfirmed((c) => ({ ...c, [item.id]: true }));
      /* Undoing the last drop, with nothing left suggested, puts back the plan that was confirmed. */
      const after = problemsAfter([...active, item]);
      const settled =
        !after && suggested.length === 0 && !plan.placements.some((p) => p.dropped && p.id !== item.id);
      setAnnouncement(`${item.course.code} added back. ${after || (settled ? "Plan confirmed." : "Confirmed.")}`);
    },
    later(item: Placement) {
      item.defer?.();
      setAnnouncement(`${item.course.code} moved to a later term.`);
    },
  };

  return (
    <div
      className="sp"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        if (pinned) preview.cancel();
        else if (selected) link.select(null, "list");
      }}
    >
      <div className="sp-layout">
        <section aria-labelledby={`${id}-week`}>
          <div className="sp-toolbar">
            <h2 id={`${id}-week`}>Weekly schedule</h2>
            {previewing ? (
              <span className="sp-toolbar-preview">
                <i aria-hidden="true" />
                Previewing {previewing.alt.code} ·{" "}
                {previewing.credits === plan.credits
                  ? `${plan.credits} credits`
                  : `${plan.credits} → ${previewing.credits} credits`}
              </span>
            ) : (
              <span data-tone={problems.some((p) => p.kind !== "conflict") ? "warn" : undefined}>
                {plan.credits} credits
                {plan.credits > CREDIT_MAX && <> · over {CREDIT_MAX}</>}
                {problems.some((p) => p.kind === "under") && <> · under {CREDIT_MIN}</>}
              </span>
            )}
          </div>
          <div className="sp-calendar">
            <Week
              plan={plan}
              confirmed={confirmed}
              link={link}
              previewing={previewing}
              kindOf={kindFor}
            />
          </div>
          <Legend free={active.some((p) => kindFor(p) === "free-elective")} />
        </section>
        <section aria-labelledby={`${id}-courses`}>
          <div className="sp-toolbar">
            <h2 id={`${id}-courses`}>Your courses</h2>
            {coursesAction}
          </div>
          <CourseList
            plan={plan}
            confirmed={confirmed}
            planConfirmed={planConfirmed}
            problems={problems}
            activeCount={active.length}
            decide={decide}
            announcement={announcement}
            link={link}
            previewing={previewing}
            preview={preview}
            kindOf={kindFor}
            fromShortlist={plan.fromShortlist ?? NONE}
          />
        </section>
      </div>
    </div>
  );
}

function clock(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")}`;
}

function hourLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  return { n: h % 12 || 12, suffix: h < 12 ? "AM" : "PM" };
}

function duration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}

export type Link = {
  selected: string | null;
  hovered: string | null;
  selectedFrom: "week" | "list" | null;
  select: (id: string | null, from: "week" | "list") => void;
  hover: (id: string | null) => void;
};

type Entry = {
  key: string;
  item: Placement;
  course: Offering;
  /* normal: in the plan. outgoing: would be replaced. incoming: the previewed alternative. */
  role: "normal" | "outgoing" | "incoming";
};

function Week({
  plan,
  confirmed,
  link,
  previewing,
  kindOf,
}: {
  plan: PairPlan;
  confirmed: Confirmed;
  link: Link;
  previewing: Previewing | null;
  kindOf: KindOf;
}) {
  const active = plan.placements.filter((item) => !item.deferred);
  /*
   * The day starts at 8 AM when a course does (sample sections run 8:00–5:40), otherwise
   * at 9, and ends at 6 PM when a course runs past 5, so no class draws outside the grid.
   */
  const met = active.filter((item) => item.course.days.length);
  const dayStart = met.some((item) => item.course.start < DAY_START) ? DAY_START - 60 : DAY_START;
  const dayEnd = met.some((item) => item.course.end > DAY_END) ? DAY_END + 60 : DAY_END;
  const lines: number[] = [];
  for (let minute = dayStart; minute <= dayEnd; minute += 60) lines.push(minute);

  const entries: Entry[] = active.flatMap((item): Entry[] =>
    previewing && previewing.item.id === item.id
      ? [
          { key: item.id, item, course: item.course, role: "outgoing" },
          { key: `${item.id}:preview`, item, course: previewing.alt, role: "incoming" },
        ]
      : [{ key: item.id, item, course: item.course, role: "normal" }],
  );
  /* What the week would be if the previewed swap happened. Headers and conflicts read from this. */
  const after = entries.filter((e) => e.role !== "outgoing");

  return (
    <div
      className="sp-week"
      role="group"
      aria-label="Week of classes"
      data-focusing={link.selected !== null && active.some((p) => p.id === link.selected) ? true : undefined}
      data-previewing={previewing ? true : undefined}
      style={{ ["--sp-hours" as string]: (dayEnd - dayStart) / 60 }}
    >
      <div className="sp-week-head">
        <div />
        {DAYS.map((day) => {
          const today = after.filter((e) => e.course.days.includes(day)).map((e) => e.course);
          const minutes = today.reduce((sum, c) => sum + c.end - c.start, 0);
          const changed =
            previewing !== null &&
            previewing.item.course.days.includes(day) !== previewing.alt.days.includes(day);
          return (
            <div
              key={day}
              className="sp-day-head"
              data-empty={today.length === 0 || undefined}
              data-changed={changed || undefined}
            >
              <span className="sp-day-name">{day}</span>
              <FitLine
                className="sp-day-meta"
                options={
                  today.length === 0
                    ? ["Free"]
                    : [
                        `${today.length} ${today.length === 1 ? "class" : "classes"} · ${duration(minutes)}`,
                        `${today.length} ${today.length === 1 ? "class" : "classes"}`,
                        `${today.length}`,
                      ]
                }
              />
            </div>
          );
        })}
      </div>

      {/* Clicking empty time clears the selection, like tapping blank space in iOS Calendar. */}
      <div
        className="sp-week-body"
        onClick={(event) => {
          if (!(event.target as HTMLElement).closest(".sp-block")) link.select(null, "week");
        }}
      >
        <div className="sp-hours" aria-hidden="true">
          {lines.map((minute) => {
            const { n, suffix } = hourLabel(minute);
            return (
              <span key={minute} className="sp-hour" style={{ top: `calc(var(--sp-hour) * ${(minute - dayStart) / 60})` }}>
                {n}
                <small>{suffix}</small>
              </span>
            );
          })}
        </div>
        {DAYS.map((day) => {
          const today = entries.filter((e) => e.course.days.includes(day));
          const todayAfter = today.filter((e) => e.role !== "outgoing");
          return (
            <div key={day} className="sp-day">
              {today.map((e) => {
                const clashes =
                  e.role === "outgoing"
                    ? []
                    : todayAfter.filter((o) => o !== e && overlaps(o.course, e.course));
                const lane = todayAfter
                  .filter((o) => o === e || clashes.includes(o))
                  .indexOf(e);
                const top = `calc(var(--sp-hour) * ${(e.course.start - dayStart) / 60})`;
                const height = `calc(var(--sp-hour) * ${(e.course.end - e.course.start) / 60} - 2px)`;
                const width = clashes.length ? "calc(50% - 5px)" : "calc(100% - 6px)";
                const left = clashes.length && lane > 0 ? "calc(50% + 2px)" : "3px";
                const state = confirmed[e.item.id] ? "confirmed" : "suggested";
                const time = `${clock(e.course.start)}–${clock(e.course.end)}`;
                const body = (
                  <>
                    <BlockText title={e.course.title} code={e.course.code} time={time} />
                    {clashes.length > 0 && (
                      <span className="sp-block-flag" aria-hidden="true">
                        !
                      </span>
                    )}
                  </>
                );

                if (e.role === "incoming") {
                  return (
                    <div
                      key={e.key}
                      className={`sp-block sp-${kindOf(e.item)}`}
                      data-role="incoming"
                      data-clash={clashes.length > 0 || undefined}
                      style={{ top, height, width, left }}
                      role="img"
                      aria-label={`Preview: ${e.course.code} ${e.course.title}, ${formatMeetings(e.course)}${clashes.length ? ", time conflict" : ""}`}
                    >
                      {body}
                    </div>
                  );
                }

                const selected = e.role === "normal" && link.selected === e.item.id;
                return (
                  <button
                    type="button"
                    key={e.key}
                    className={`sp-block sp-${kindOf(e.item)}`}
                    data-role={e.role}
                    data-state={state}
                    aria-pressed={link.selected === e.item.id}
                    data-selected={selected || undefined}
                    data-linked={(e.role === "normal" && link.hovered === e.item.id) || undefined}
                    data-clash={clashes.length > 0 || undefined}
                    onClick={() => link.select(e.item.id, "week")}
                    onPointerEnter={() => link.hover(e.item.id)}
                    onPointerLeave={() => link.hover(null)}
                    style={{ top, height, width, left }}
                    title={`${e.course.code} · ${e.course.title}`}
                    aria-label={`${e.role === "outgoing" ? "Would be replaced: " : state === "suggested" ? "Suggested: " : ""}${e.course.code} ${e.course.title}, ${formatMeetings(e.course)}${clashes.length ? ", time conflict" : ""}`}
                  >
                    {body}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Legend({ free }: { free: boolean }) {
  const kinds: Placement["kind"][] = ["core", "elective", "gened", ...(free ? (["free-elective"] as const) : [])];
  return (
    <div className="sp-legend">
      {kinds.map((kind) => (
        <span key={kind} className="sp-legend-item">
          <i className={`sp-swatch sp-${kind}`} aria-hidden="true" />
          {kind === "core" ? "Core" : KIND_LABEL[kind]}
        </span>
      ))}
    </div>
  );
}

type IconName = "add" | "drop" | "check";
function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "check" ? (
        <path d="m3 8 3 3 7-7" />
      ) : name === "drop" ? (
        <path d="M4 8h8" />
      ) : (
        <path d="M4 8h8M8 4v8" />
      )}
    </svg>
  );
}

export type Decide = {
  confirmAll: () => void;
  editPlan: () => void;
  swap: (item: Placement, code: string) => void;
  remove: (item: Placement) => void;
  addBack: (item: Placement) => void;
  later: (item: Placement) => void;
};

/*
 * Your courses — Cards with a Drill-in course page. See productthink.md,
 * "Your courses" and "Course details".
 * Every course is a card: code and credits, title, days and time, Or chips.
 * The whole card opens the course page, as does its class in the week.
 */

const CHOICE_KINDS: Placement["kind"][] = ["elective", "gened", "free-elective"];

/* "Principles of Data Science" → "Data Science": chips name the subject, not the boilerplate. */
function shortTitle(title: string) {
  return title.replace(/^(Principles of|Introduction to)\s+/i, "").split(":")[0];
}

type PreviewControls = {
  peek: (itemId: string | null, code?: string) => void;
  pin: (item: Placement, option: Offering) => void;
  cancel: () => void;
};

type ListProps = {
  plan: PairPlan;
  confirmed: Confirmed;
  planConfirmed: boolean;
  /* Why Confirm plan is blocked; empty when the plan can be confirmed. */
  problems: PlanProblem[];
  activeCount: number;
  decide: Decide;
  announcement: string;
  link: Link;
  previewing: Previewing | null;
  preview: PreviewControls;
  kindOf: KindOf;
  fromShortlist: ReadonlySet<string>;
};

const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function scrollWithin(box: HTMLElement, el: HTMLElement, align: "top" | "bottom") {
  const boxTop = box.getBoundingClientRect().top;
  const r = el.getBoundingClientRect();
  if (align === "top") {
    box.scrollTo({ top: r.top - boxTop + box.scrollTop - 12, behavior: calm() ? "auto" : "smooth" });
    return;
  }
  const bottom = r.bottom - boxTop + box.scrollTop + 12;
  if (bottom > box.scrollTop + box.clientHeight)
    box.scrollTo({ top: bottom - box.clientHeight, behavior: calm() ? "auto" : "smooth" });
}

/* A pinned preview's Swap / Cancel stays in view. */
function usePinnedInView(ref: RefObject<HTMLElement | null>, previewing: Previewing | null) {
  const key = previewing?.pinned ? `${previewing.item.id}:${previewing.alt.code}` : null;
  useEffect(() => {
    if (!key) return;
    const box = ref.current;
    const el = box?.querySelector<HTMLElement>(`[data-impact="${key}"]`);
    if (box && el) scrollWithin(box, el, "bottom");
  }, [ref, key]);
}

function CourseList(props: ListProps) {
  const { plan, link, previewing, kindOf, fromShortlist } = props;
  /*
   * Choices first, then major core. Shortlisted courses go with the choices, after the
   * planner's own. Dropped courses keep their place, dimmed, until Confirm plan removes them.
   */
  const mine = (p: Placement) => fromShortlist.has(p.course.code);
  const cards = [
    ...plan.placements.filter((p) => !mine(p) && CHOICE_KINDS.includes(kindOf(p))),
    ...plan.placements.filter(mine),
    ...plan.placements.filter((p) => !mine(p) && !CHOICE_KINDS.includes(kindOf(p))),
  ];

  /* The course page is open whenever a course is selected, from the list or the week. */
  const openItem = cards.find((p) => p.id === link.selected) ?? null;
  /* Keep the last page rendered while it slides away. */
  const [page, setPage] = useState<Placement | null>(openItem);
  if (openItem && openItem.id !== page?.id) setPage(openItem);
  const shown = openItem ?? page;

  const backRef = useRef<HTMLButtonElement>(null);
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const lastOpen = useRef<string | null>(null);
  const pageScroll = useRef<HTMLDivElement>(null);
  usePinnedInView(pageScroll, previewing);

  /* Focus follows the navigation: into the page on open, back to its card on return. */
  const openId = openItem?.id ?? null;
  useEffect(() => {
    if (openId) {
      pageScroll.current?.scrollTo({ top: 0 });
      backRef.current?.focus({ preventScroll: true });
      lastOpen.current = openId;
    } else if (lastOpen.current) {
      cardRefs.current[lastOpen.current]?.focus({ preventScroll: true });
      lastOpen.current = null;
    }
  }, [openId]);

  const close = () => {
    if (link.selected) link.select(link.selected, "list");
  };

  return (
    <div className="sp-card sp-drill" data-open={openItem ? true : undefined}>
      <div className="sp-track">
        <div className="sp-pane" inert={Boolean(openItem)}>
          <div className="sp-card-scroll">
            {cards.map((item) => (
              <CourseCard
                key={item.id}
                item={item}
                props={props}
                mainRef={(el) => {
                  cardRefs.current[item.id] = el;
                }}
              />
            ))}
          </div>
          <Footer {...props} />
        </div>

        <div className="sp-pane" inert={!openItem}>
          <header className="sp-card-head sp-page-head">
            <button className="sp-back sp-hit" ref={backRef} onClick={close}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m10 4-4 4 4 4" />
              </svg>
              Your courses
            </button>
          </header>
          <div className="sp-page-scroll" ref={pageScroll}>
            {shown && <CourseDetails item={shown} props={props} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function CourseCard({
  item,
  props,
  mainRef,
}: {
  item: Placement;
  props: ListProps;
  mainRef: (el: HTMLButtonElement | null) => void;
}) {
  const { link, confirmed } = props;
  const dropped = Boolean(item.deferred);
  const alts = dropped ? [] : item.options.filter((o) => o.code !== item.course.code);
  const clashes = dropped ? [] : props.plan.conflictsFor(item.id);
  const pinnedAlt = alts.find((o) => previewHandlers(props, item, o).pinned);
  const offNote = item.dropped ? "Dropped" : "Later term";
  /* Where the planner's cards would say why, a shortlisted course says who picked it. */
  const reason = props.fromShortlist.has(item.course.code) ? item.course.why : null;

  return (
    <article
      className={`sp-ccard sp-${props.kindOf(item)}`}
      data-item={item.id}
      data-linked={link.hovered === item.id || undefined}
      data-confirmed={confirmed[item.id] || undefined}
      data-dropped={dropped || undefined}
      onPointerEnter={() => link.hover(item.id)}
      onPointerLeave={() => link.hover(null)}
    >
      <button
        ref={mainRef}
        className="sp-ccard-main"
        aria-label={`${item.course.code} ${item.course.title}, ${formatMeetings(item.course)}${reason ? `. ${reason}` : ""}. Open course details`}
        onClick={() => link.select(item.id, "list")}
      >
        <span className="sp-ccard-top">
          {/* Category is carried by color (see the legend), so the eyebrow names the course instead. */}
          <span className="sp-ccard-code">
            {item.course.code} · {item.course.credits} {item.course.credits === 1 ? "credit" : "credits"}
          </span>
          {dropped && <span className="sp-ccard-status">{offNote}</span>}
        </span>
        <span className="sp-ccard-title">{item.course.title}</span>
        <MeetingTime course={item.course} />
        {reason && (
          <span className="sp-ccard-meta sp-reason" aria-hidden="true">
            {reason}
          </span>
        )}
      </button>

      {clashes.length > 0 && (
        <p className="sp-ccard-warn">
          Overlaps {clashes.map((c) => c.course.code).join(", ")}. Preview another option to see if
          it fits.
        </p>
      )}

      <div className="sp-chips">
        {alts.length > 0 && <span className="sp-chips-label">Or</span>}
        {alts.map((option) => {
          const { pinned, peeking, handlers } = previewHandlers(props, item, option);
          return (
            <button
              key={option.code}
              className="sp-chip sp-hit"
              aria-pressed={pinned}
              aria-label={`Preview ${option.code} ${option.title}, ${formatMeetings(option)}`}
              data-peeking={peeking || undefined}
              title={`${option.code} · ${option.title} · ${formatMeetings(option)}`}
              {...handlers}
            >
              <span className="sp-chip-label">{shortTitle(option.title)}</span>
            </button>
          );
        })}
        <AddDropButton item={item} props={props} />
      </div>

      {pinnedAlt && <PreviewPanel item={item} option={pinnedAlt} props={props} />}
    </article>
  );
}

/* ---------- Course page data (courses.json, sections.json) ---------- */

type PrereqNode = { op?: "all" | "any"; of?: PrereqNode[]; kind?: string; code?: string };
type CourseRecord = {
  title: string;
  credits?: { value?: number; options?: number[]; min?: number; max?: number };
  description?: string;
  attributes?: string[];
  typicallyOffered?: string | null;
  prerequisites?: { raw?: string; expression?: PrereqNode } | null;
};
const catalog = courses as unknown as Record<string, CourseRecord>;

const ATTRIBUTES: Record<string, string> = {
  WI: "Writing intensive",
  GU: "Gen ed · U.S. Society",
  SI: "Gen ed · Science & Technology",
};

const COURSE_CODE = /[A-Z]{2,4} \d{4}[A-Z]?/g;

/* How `code` appears in a prerequisite tree: needed outright, or one of several options. */
function roleIn(node: PrereqNode | undefined, code: string, inAny = false): "required" | "option" | null {
  if (!node) return null;
  if (node.kind === "course") return node.code === code ? (inAny ? "option" : "required") : null;
  let found: "required" | "option" | null = null;
  for (const child of node.of ?? []) {
    const r = roleIn(child, code, inAny || node.op === "any");
    if (r === "required") return r;
    found ??= r;
  }
  return found;
}

/* Reverse prerequisites, built once: which courses list this one. */
let unlocksIndex: Map<string, { code: string; title: string; role: "required" | "option" }[]> | null = null;
function prerequisiteFor(code: string) {
  if (!unlocksIndex) {
    unlocksIndex = new Map();
    for (const [other, rec] of Object.entries(catalog)) {
      const raw = rec.prerequisites?.raw ?? "";
      for (const listed of new Set(raw.match(COURSE_CODE) ?? [])) {
        const role = roleIn(rec.prerequisites?.expression, listed) ?? "required";
        const list = unlocksIndex.get(listed) ?? [];
        list.push({ code: other, title: rec.title, role });
        unlocksIndex.set(listed, list);
      }
    }
    for (const list of unlocksIndex.values()) list.sort((a, b) => a.code.localeCompare(b.code));
  }
  return unlocksIndex.get(code) ?? [];
}

/* The course page: everything a student needs to learn about it, then the decisions. */
function CourseDetails({ item, props }: { item: Placement; props: ListProps }) {
  const rec = catalog[item.course.code];
  const section = sections.find((s) => s.course === item.course.code);
  const raw = rec?.prerequisites?.raw ?? "";
  const prereqs = [...new Set(raw.match(COURSE_CODE) ?? [])];
  const unlocks = prerequisiteFor(item.course.code);
  const inPlan = new Set(props.plan.placements.filter((p) => !p.deferred).map((p) => p.course.code));
  const attributes = (rec?.attributes ?? []).map((a) => ATTRIBUTES[a] ?? a);
  const dropped = Boolean(item.deferred);
  const alts = dropped ? [] : item.options.filter((o) => o.code !== item.course.code);
  const clashes = dropped ? [] : props.plan.conflictsFor(item.id);

  return (
    <div className="sp-details">
      <header className={`sp-details-head sp-${props.kindOf(item)}`}>
        <span className="sp-ccard-code">
          {item.course.code} · {item.course.credits} {item.course.credits === 1 ? "credit" : "credits"}
        </span>
        <h3 className="sp-details-title">{item.course.title}</h3>
        <MeetingTime course={item.course} />
      </header>

      {clashes.length > 0 && (
        <p className="sp-ccard-warn">
          Overlaps {clashes.map((c) => c.course.code).join(", ")}. Preview another option below to see if it fits.
        </p>
      )}

      {section && (
        <dl className="sp-facts">
          <div>
            <dt>Section</dt>
            <dd>{section.section}</dd>
          </div>
          <div>
            <dt>Instructor</dt>
            <dd>{section.instructor}</dd>
          </div>
          <div>
            <dt>Campus</dt>
            <dd>{section.campus}</dd>
          </div>
        </dl>
      )}

      <section className="sp-dblock">
        <h4>About this course</h4>
        <p>{rec?.description ?? "No description in the bulletin."}</p>
      </section>

      <section className="sp-dblock">
        <h4>Prerequisite for</h4>
        {unlocks.length ? (
          <ul className="sp-courselist">
            {unlocks.map((u) => (
              <li key={u.code}>
                <b>{u.code}</b>
                <span>
                  {u.title}
                  {(u.role === "option" || inPlan.has(u.code)) && (
                    <small>
                      {[u.role === "option" ? "one of the accepted options" : null, inPlan.has(u.code) ? "in your plan" : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No other course lists it as a prerequisite.</p>
        )}
      </section>

      <section className="sp-dblock">
        <h4>Prerequisites</h4>
        {prereqs.length ? (
          <>
            <ul className="sp-courselist">
              {prereqs.map((code) => (
                <li key={code}>
                  <b>{code}</b>
                  <span>{catalog[code]?.title ?? ""}</span>
                </li>
              ))}
            </ul>
            <p className="sp-fine">{raw}.</p>
          </>
        ) : (
          <p>None.</p>
        )}
      </section>

      {(attributes.length > 0 || rec?.typicallyOffered) && (
        <section className="sp-dblock">
          <h4>Good to know</h4>
          <div className="sp-tags">
            {attributes.map((a) => (
              <span key={a} className="sp-tag">
                {a}
              </span>
            ))}
            {rec?.typicallyOffered && (
              <span className="sp-tag">Usually offered {rec.typicallyOffered.replace(/^the /, "")}</span>
            )}
          </div>
        </section>
      )}

      {alts.length > 0 && (
        <section className="sp-dblock">
          <h4>Or take instead</h4>
          {alts.map((option) => {
            const { pinned, peeking, handlers } = previewHandlers(props, item, option);
            return (
              <div key={option.code} className="sp-alt-wrap">
                <button className="sp-alt" aria-pressed={pinned} data-peeking={peeking || undefined} {...handlers}>
                  <span>
                    <span className="sp-alt-title">{option.title}</span>
                    <span className="sp-ccard-meta">
                      {option.code} · {formatMeetings(option)} · {option.credits} credits
                    </span>
                  </span>
                  <span className="sp-alt-cue">{pinned ? "Previewing" : "Preview"}</span>
                </button>
                {pinned && <PreviewPanel item={item} option={option} props={props} />}
              </div>
            );
          })}
        </section>
      )}

      <div className="sp-details-actions">
        {item.defer && !dropped && (
          <button className="sp-text-btn sp-hit" onClick={() => props.decide.later(item)}>
            Take it in a later term
          </button>
        )}
        <AddDropButton item={item} props={props} />
      </div>
    </div>
  );
}

const DAY_NAMES: Record<Day, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
};

function clockWithPeriod(minutes: number) {
  const h = Math.floor(minutes / 60);
  return { time: `${h % 12 || 12}:${(minutes % 60).toString().padStart(2, "0")}`, period: h < 12 ? "AM" : "PM" };
}

/* "2:00–3:20 PM", or "11:00 AM–12:20 PM" when the class crosses noon. */
function timeRange(start: number, end: number) {
  const a = clockWithPeriod(start);
  const b = clockWithPeriod(end);
  return a.period === b.period ? `${a.time}–${b.time} ${b.period}` : `${a.time} ${a.period}–${b.time} ${b.period}`;
}

/* "Tue-Thu · 2:00–3:20 PM" */
function MeetingTime({ course }: { course: Offering }) {
  const spoken = `${new Intl.ListFormat("en", { type: "conjunction" }).format(course.days.map((d) => DAY_NAMES[d]))}, ${timeRange(course.start, course.end)}`;
  return (
    <span className="sp-ccard-meta" aria-label={spoken}>
      {course.days.join("-")} · {timeRange(course.start, course.end)}
    </span>
  );
}

/* Hover/focus peeks, click pins. */
function previewHandlers(props: ListProps, item: Placement, option: Offering) {
  const on = props.previewing?.item.id === item.id && props.previewing.alt.code === option.code;
  const pinned = Boolean(on && props.previewing?.pinned);
  return {
    pinned,
    peeking: Boolean(on && !pinned),
    handlers: {
      onPointerEnter: () => props.preview.peek(item.id, option.code),
      onPointerLeave: () => props.preview.peek(null),
      onFocus: () => props.preview.peek(item.id, option.code),
      onBlur: () => props.preview.peek(null),
      onClick: () => (pinned ? props.preview.cancel() : props.preview.pin(item, option)),
    },
  };
}

/* What a swap would change, with the commit. */
function PreviewPanel({ item, option, props }: { item: Placement; option: Offering; props: ListProps }) {
  const { previewing, plan, decide, preview } = props;
  if (!previewing) return null;
  return (
    <div className="sp-impact" data-impact={`${item.id}:${option.code}`}>
      <p className="sp-impact-title">
        {option.title}
      </p>
      <ul>
        <li>
          <span>Meets</span>
          {formatMeetings(option)}
          <small>instead of {formatMeetings(item.course)}</small>
        </li>
        <li data-tone={previewing.credits > CREDIT_MAX || previewing.credits < CREDIT_MIN ? "warn" : undefined}>
          <span>Credits</span>
          {previewing.credits === plan.credits
            ? `${plan.credits}, no change`
            : `${plan.credits} → ${previewing.credits}`}
          {previewing.credits > CREDIT_MAX && <small>Over the {CREDIT_MAX} credit limit</small>}
          {previewing.credits < CREDIT_MIN && <small>Under the {CREDIT_MIN} credit minimum</small>}
        </li>
        <li data-tone={previewing.clashes.length ? "warn" : "ok"}>
          <span>Conflicts</span>
          {previewing.clashes.length
            ? `Overlaps ${previewing.clashes.map((c) => c.course.code).join(", ")}`
            : "None"}
        </li>
      </ul>
      <div className="sp-impact-actions">
        <button className="sp-swap" onClick={() => decide.swap(item, option.code)}>
          Swap to {option.code}
        </button>
        <button className="sp-text-btn is-quiet sp-hit" onClick={preview.cancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/*
 * Add / Drop, the registration words students already use. One button per course,
 * the same element in both states, so focus never drops and nothing reflows.
 * Confirming is for the whole semester ("Confirm plan"), not per course.
 */
function AddDropButton({ item, props }: { item: Placement; props: ListProps }) {
  const dropped = Boolean(item.deferred);
  return (
    <button
      className="sp-adddrop sp-hit"
      data-mode={dropped ? "add" : "drop"}
      aria-label={`${dropped ? "Add" : "Drop"} ${item.course.code} ${item.course.title}`}
      onClick={() => (dropped ? props.decide.addBack(item) : props.decide.remove(item))}
    >
      <Icon name={dropped ? "add" : "drop"} size={14} />
      <span>{dropped ? "Add" : "Drop"}</span>
    </button>
  );
}

/*
 * One next step. Before: the red Confirm plan. After: a quiet confirmed state with
 * Edit plan. Both rows are the same height so the panel never jumps, and focus
 * moves to whichever button replaced the one just pressed. While a problem stands
 * (credits, overlaps), what is wrong sits above Confirm plan and the plan cannot be confirmed.
 */
function Footer({ planConfirmed: confirmed, problems, activeCount, decide, announcement }: ListProps) {
  const warnId = useId();
  const actionRef = useRef<HTMLButtonElement>(null);
  const pressed = useRef(false);
  useEffect(() => {
    if (pressed.current) actionRef.current?.focus({ preventScroll: true });
    pressed.current = false;
  }, [confirmed]);

  return (
    <footer className="sp-card-foot" data-confirmed={confirmed || undefined}>
      {confirmed ? (
        <div className="sp-confirmed-row">
          <span className="sp-confirmed-state">
            <span className="sp-confirmed-badge" aria-hidden="true">
              <Icon name="check" size={12} />
            </span>
            Plan confirmed
          </span>
          <button
            ref={actionRef}
            className="sp-edit"
            onClick={() => {
              pressed.current = true;
              decide.editPlan();
            }}
          >
            Edit plan
          </button>
        </div>
      ) : activeCount > 0 ? (
        <>
          {/* Blocked, Confirm plan stays focusable, so the reasons are read with it. */}
          {problems.length > 0 && <FootProblems id={warnId} problems={problems} />}
          <button
            ref={actionRef}
            className="btn-primary"
            aria-disabled={problems.length ? true : undefined}
            aria-describedby={problems.length ? warnId : undefined}
            onClick={() => {
              pressed.current = !problems.length;
              decide.confirmAll();
            }}
          >
            Confirm plan
          </button>
        </>
      ) : (
        <p className="sp-foot-empty">
          <strong>Nothing in your plan</strong>
          Add a course back, or find new ones.
        </p>
      )}
      <p className="sp-sr" aria-live="polite">
        {announcement}
      </p>
    </footer>
  );
}

/*
 * One line per problem, up to two. From three on, one summary line instead, so the
 * footer never takes the course list's room: each overlap is still flagged on its cards
 * and its classes in the week, and pressing Confirm plan reads every problem in full.
 */
function FootProblems({ id, problems }: { id: string; problems: PlanProblem[] }) {
  if (problems.length < 3) {
    return (
      <ul className="sp-foot-warn" id={id}>
        {problems.map((p) => (
          <li key={p.key}>{p.text}</li>
        ))}
      </ul>
    );
  }
  const credit = problems.find((p) => p.kind !== "conflict");
  const overlaps = problems.filter((p) => p.kind === "conflict").length;
  const parts = [
    credit?.text.split(". ")[0],
    `${overlaps} pairs of classes overlap, marked on their courses`,
  ].filter(Boolean);
  return (
    <p className="sp-foot-warn" id={id}>
      {problems.length} problems: {parts.join("; ")}.
    </p>
  );
}
