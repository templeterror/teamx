"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { usePlanContext } from "@/components/plan/plan-shell";
import type { Placement } from "@/components/plan/use-plan";
import { SHORTLIST_MAX } from "@/components/plan/use-shortlist";
import { OPEN_GENED, buildRows, rowKind, type Scope } from "./catalog";
import { Finder } from "./finder";
import { MiniWeek, type MiniItem } from "./mini-week";
import { CoursePage } from "./course-page";
import "./find-page.css";

/*
 * The Find page, /find (productthink.md, "Finding courses is its own page").
 * Left: the Bar finder at full height. Right: the mini week, the shortlist and
 * one primary back to the plan. Course details open in the right column as the
 * Drill-in. The only verb here is Shortlist; Add and Drop stay on the plan.
 * Layout classes are `finder-` prefixed, like the finder's own.
 */

const calm = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* "13 credits", "13 credits + 1 variable" */
function creditsText(credits: number, variable: number) {
  const base = `${credits} ${credits === 1 ? "credit" : "credits"}`;
  return variable ? `${base} + ${variable} variable` : base;
}

function scopeLine(scope: Scope, placements: Placement[]) {
  const open = placements.filter((p) => !p.deferred && p.options.length > 0);
  const electives = open.filter((p) => p.kind === "elective").length;
  const gened = open.filter((p) => p.kind === "gened").length;
  if (scope === "gened") return `For: Gen ed · ${OPEN_GENED.label} · ${gened} to choose`;
  if (scope === "major-elective") return `For: Major electives · ${electives} to choose`;
  if (scope === "free") return `For: Free electives · ${electives} to choose`;
  return `For: Any open slot · ${electives + gened} to choose`;
}

export function FindPage({ scope, scoped }: { scope: Scope; scoped: boolean }) {
  const uid = useId();
  const plan = usePlanContext();
  const { shortlist, placements, addCourse, toggleCourse } = plan;
  const rows = useMemo(
    () => buildRows({ placements, addCourse, toggleCourse }),
    [placements, addCourse, toggleCourse],
  );
  const rowByCode = useMemo(() => new Map(rows.map((r) => [r.code, r])), [rows]);

  /* Hover wins over focus; the shortlist rows report through the same channel. */
  const [hover, setHover] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const onPreview = useCallback((code: string | null, via: "hover" | "focus") => {
    if (via === "hover") setHover(code);
    else setFocused(code);
  }, []);

  /* Drill-in: the course page slides over the week and the shortlist. */
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [shownCode, setShownCode] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const returnFocus = useRef<HTMLElement | null>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const pageScroll = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const wasOpen = useRef(false);

  function open(code: string, opener: HTMLElement) {
    returnFocus.current = opener;
    setOpenCode(code);
    setShownCode(code);
    setHover(null);
    setFocused(null);
  }
  const close = () => setOpenCode(null);

  useEffect(() => {
    if (openCode) {
      pageScroll.current?.scrollTo({ top: 0 });
      backRef.current?.focus({ preventScroll: true });
      wasOpen.current = true;
    } else if (wasOpen.current) {
      wasOpen.current = false;
      const el = returnFocus.current;
      if (el?.isConnected) {
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: "nearest", behavior: calm() ? "auto" : "smooth" });
      }
    }
  }, [openCode]);

  /* ---- Mini week ---- */

  /* Only what the student has chosen is drawn: confirmed courses and the shortlist. */
  const active = plan.placements.filter((p) => !p.deferred);
  const planCodes = new Set(active.map((p) => p.course.code));
  const confirmedPlan = active.filter((p) => plan.confirmed[p.id]);
  const confirmedCredits = confirmedPlan.reduce((sum, p) => sum + p.course.credits, 0);
  /* Fixed credits summed; `variable` counts courses whose credits are chosen in Banner. */
  let shortlistCredits = 0;
  let shortlistVariable = 0;
  for (const code of shortlist.codes) {
    const c = rowByCode.get(code)?.credits;
    if (typeof c === "number") shortlistCredits += c;
    else shortlistVariable += 1;
  }
  const kindFor = (p: Placement) => {
    if (!p.id.startsWith("catalog-")) return p.kind;
    const row = rowByCode.get(p.course.code);
    return row ? rowKind(row) : p.kind;
  };
  const items: MiniItem[] = [
    ...confirmedPlan.map((p) => ({
      key: p.id,
      code: p.course.code,
      title: p.course.title,
      course: p.course,
      kind: kindFor(p),
      role: "plan" as const,
    })),
    ...shortlist.codes
      .filter((c) => !planCodes.has(c))
      .flatMap((c) => {
        const row = rowByCode.get(c);
        return row
          ? [{ key: `s-${c}`, code: c, title: row.title, course: row.offering, kind: rowKind(row), role: "shortlist" as const }]
          : [];
      }),
  ];

  const previewCode = hover ?? focused;
  const previewRow = previewCode ? rowByCode.get(previewCode) : undefined;
  const drawn = previewCode !== null && items.some((it) => it.code === previewCode);
  const ghost: MiniItem | null =
    previewRow && !drawn && !previewRow.completed && previewRow.offering.days.length
      ? {
          key: "ghost",
          code: previewRow.code,
          title: previewRow.title,
          course: previewRow.offering,
          kind: rowKind(previewRow),
          role: "shortlist",
        }
      : null;
  const shortlistDrawn = items.filter((it) => it.role === "shortlist").length;
  const weekLine = [
    confirmedPlan.length
      ? `${confirmedCredits} ${confirmedCredits === 1 ? "credit" : "credits"} confirmed`
      : "Nothing confirmed yet",
    ...(shortlistDrawn ? [`${shortlistDrawn} shortlisted`] : []),
  ].join(" · ");

  /* ---- Shortlist list ---- */

  function removeFromList(code: string, index: number) {
    shortlist.remove(code);
    setAnnouncement(`${code} removed from your shortlist.`);
    setHover(null);
    setFocused(null);
    /* Focus the next row's remove button, or the previous one, or the list. */
    requestAnimationFrame(() => {
      const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>(".finder-sl-remove");
      const next = buttons?.[Math.min(index, (buttons?.length ?? 1) - 1)];
      if (next) next.focus();
      else document.getElementById(`${uid}-sl`)?.focus();
    });
  }

  const shownRow = shownCode ? rowByCode.get(shownCode) : undefined;
  const n = shortlist.count;

  return (
    <div
      className="finder-page"
      data-pending={shortlist.ready ? undefined : ""}
      onKeyDown={(e) => {
        if (e.key === "Escape" && openCode) {
          e.preventDefault();
          close();
        }
      }}
    >
      <Finder
        rows={rows}
        initialScope={scope}
        shortlist={shortlist}
        previewCode={previewCode}
        onPreview={onPreview}
        onOpen={open}
        openCode={openCode}
        context={scoped ? (chosen) => scopeLine(chosen, plan.placements) : null}
      />

      <aside className="finder-side" aria-label="Your week and shortlist">
        <div className="finder-panel" data-open={openCode ? "" : undefined}>
          <div className="finder-track">
            <div className="finder-pane" inert={Boolean(openCode)}>
              <section className="finder-week" aria-labelledby={`${uid}-week`}>
                <header className="finder-sec-head">
                  <h2 id={`${uid}-week`}>Your week</h2>
                  <span>{weekLine}</span>
                </header>
                <MiniWeek items={items} ghost={ghost} hotCode={drawn ? previewCode : null} />
              </section>

              <section className="finder-list" aria-labelledby={`${uid}-sl`}>
                <header className="finder-sec-head">
                  <h2 id={`${uid}-sl`} tabIndex={-1}>
                    Shortlist
                  </h2>
                  <span data-tone={shortlist.full ? "full" : undefined}>
                    {n} of {SHORTLIST_MAX}
                    {n > 0 && <> · {creditsText(shortlistCredits, shortlistVariable)}</>}
                  </span>
                </header>
                {n > 0 && (
                  <ul ref={listRef} className="finder-sl" onPointerLeave={() => setHover(null)}>
                    {shortlist.codes.map((code, i) => {
                      const row = rowByCode.get(code);
                      if (!row) return null;
                      const inPlan = planCodes.has(code);
                      return (
                        <li
                          key={code}
                          className="finder-sl-row"
                          data-kind={rowKind(row)}
                          data-hot={previewCode === code || undefined}
                          data-preview-code={code}
                          onPointerEnter={() => setHover(code)}
                          onFocus={() => setFocused(code)}
                          onBlur={(e) => {
                            const next = e.relatedTarget as HTMLElement | null;
                            if (!next?.closest(`[data-preview-code="${code}"]`)) setFocused(null);
                          }}
                        >
                          <button
                            type="button"
                            className="finder-sl-open"
                            aria-label={`${code} ${row.title}${inPlan ? ", in your plan" : ""}. Open course details`}
                            title={row.title}
                            onClick={(e) => open(code, e.currentTarget)}
                          >
                            <i aria-hidden="true" />
                            <b>{code}</b>
                            <span className="finder-sl-title">{row.title}</span>
                            <span className="finder-sl-cr">
                              {inPlan ? "In plan" : row.credits === null ? "Var." : `${row.credits} cr`}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="finder-sl-remove"
                            aria-label={`Remove ${code} from shortlist`}
                            title="Remove from shortlist"
                            onClick={() => removeFromList(code, i)}
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                              <path d="m4.5 4.5 7 7m0-7-7 7" />
                            </svg>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

            <div className="finder-pane finder-pagepane" inert={!openCode}>
              <CoursePage
                row={shownRow}
                plan={plan}
                shortlist={shortlist}
                backRef={backRef}
                scrollRef={pageScroll}
                onBack={close}
                onAnnounce={setAnnouncement}
              />
            </div>
          </div>

          <footer className="finder-side-foot">
            {/* The page's one red primary, shortlist or not. */}
            <Link href="/plan" className="btn-primary">
              {n > 0 ? `Back to plan with ${n} shortlisted` : "Back to plan"}
            </Link>
          </footer>
        </div>
        <p className="finder-sr" role="status">
          {announcement}
        </p>
      </aside>
    </div>
  );
}
