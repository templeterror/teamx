/*
 * The mini week on the Find page: Mon–Fri at 16px an hour, colour-coded blocks
 * with no text, so it always fits. Only what the student has chosen is drawn:
 * confirmed plan courses solid, shortlisted courses a solid left edge on a 40%
 * fill (suggested courses are left out, so an unconfirmed plan never reads as
 * decided), and the hovered or focused result a 60% ghost with amber rings on
 * what it would collide with. A hovered course that is already drawn brightens.
 * Every class is `mini-week-` prefixed.
 */

import { DAY_END, DAY_START, type Day, type Offering } from "@/components/plan/data";
import type { Placement } from "@/components/plan/use-plan";
import "./mini-week.css";

export type MiniItem = {
  key: string;
  code: string;
  title: string;
  course: Offering;
  kind: Placement["kind"];
  /* "plan" is a confirmed plan course; suggested ones are never passed in. */
  role: "plan" | "shortlist";
};

const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HOUR_PX = 16;

function overlaps(a: Offering, b: Offering) {
  return a.start < b.end && b.start < a.end;
}

const clock = (m: number) =>
  `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, "0")} ${m < 720 ? "am" : "pm"}`;

function meetingLabel(o: Offering) {
  return o.days.length ? `${o.days.join(" ")} ${clock(o.start)}–${clock(o.end)}` : "Time to be announced";
}

/*
 * The plan's week rule: start at 8 AM when anything drawn starts before 9 (otherwise 9),
 * end at 6 PM when anything runs past 5. The ghost does not move it, so hovering never
 * reflows the grid; a ghost outside the window is clipped to it.
 */
function windowFor(items: MiniItem[]) {
  const met = items.filter((it) => it.course.days.length);
  return {
    start: met.some((it) => it.course.start < DAY_START) ? DAY_START - 60 : DAY_START,
    end: met.some((it) => it.course.end > DAY_END) ? DAY_END + 60 : DAY_END,
  };
}

function geometry(o: Offering, win: { start: number; end: number }) {
  const start = Math.max(o.start, win.start);
  const end = Math.min(o.end, win.end);
  return {
    top: ((start - win.start) / 60) * HOUR_PX,
    height: Math.max(((end - start) / 60) * HOUR_PX - 1, 3),
    clipped: start !== o.start || end !== o.end,
    visible: end > start,
  };
}

/* Side-by-side lanes inside each run of overlapping blocks, so nothing hides behind anything. */
function lanes(items: MiniItem[]) {
  const sorted = [...items].sort((a, b) => a.course.start - b.course.start || a.course.end - b.course.end);
  const out = new Map<string, { lane: number; of: number }>();
  let cluster: MiniItem[] = [];
  let ends: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    for (const it of cluster) out.set(it.key, { lane: out.get(it.key)?.lane ?? 0, of: ends.length });
    cluster = [];
    ends = [];
  };
  for (const it of sorted) {
    if (it.course.start >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    let lane = ends.findIndex((end) => end <= it.course.start);
    if (lane === -1) {
      lane = ends.length;
      ends.push(it.course.end);
    } else ends[lane] = it.course.end;
    out.set(it.key, { lane, of: 0 });
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.course.end);
  }
  flush();
  return out;
}

export function MiniWeek({
  items,
  ghost,
  hotCode,
}: {
  items: MiniItem[];
  ghost: MiniItem | null;
  /* A course already drawn that the student is pointing at. */
  hotCode: string | null;
}) {
  const win = windowFor(items);
  const hours: number[] = [];
  for (let m = win.start; m <= win.end; m += 60) hours.push(m);
  const confirmed = items.some((it) => it.role === "plan");

  return (
    <>
      <div
        className="mini-week"
        style={{
          ["--mini-week-grid" as string]: `${((win.end - win.start) / 60) * HOUR_PX}px`,
          ["--mini-week-hour" as string]: `${HOUR_PX}px`,
        }}
      >
        <div className="mini-week-head" aria-hidden="true">
          <span />
          {DAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="mini-week-body">
          <div className="mini-week-hours" aria-hidden="true">
            {hours
              .filter((m) => (m / 60) % 2 === 1)
              .map((m) => (
                <span key={m} style={{ top: ((m - win.start) / 60) * HOUR_PX }}>
                  {Math.floor(m / 60) % 12 || 12}
                </span>
              ))}
          </div>
          {DAYS.map((day) => {
            const today = items.filter((it) => it.course.days.includes(day));
            const layout = lanes(today);
            const g = ghost && ghost.course.days.includes(day) ? ghost : null;
            const clashes = g ? today.filter((it) => overlaps(it.course, g.course)) : [];
            return (
              <div key={day} className="mini-week-day" role="group" aria-label={day}>
                {today.map((it) => {
                  const geo = geometry(it.course, win);
                  if (!geo.visible) return null;
                  const { lane, of } = layout.get(it.key) ?? { lane: 0, of: 1 };
                  const n = Math.max(of, 1);
                  return (
                    <div
                      key={it.key}
                      className="mini-week-block"
                      data-kind={it.kind}
                      data-role={it.role}
                      data-hot={hotCode === it.code || undefined}
                      data-ghost-clash={clashes.includes(it) || undefined}
                      role="img"
                      aria-label={`${it.role === "shortlist" ? "Shortlisted: " : ""}${it.code} ${it.title}, ${meetingLabel(it.course)}`}
                      title={`${it.code} · ${meetingLabel(it.course)}`}
                      style={{
                        top: geo.top,
                        height: geo.height,
                        left: `calc(${(lane / n) * 100}% + 2px)`,
                        width: `calc(${100 / n}% - 4px)`,
                      }}
                    />
                  );
                })}
                {g && <Ghost ghost={g} clashes={clashes} win={win} />}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mini-week-legend" aria-hidden="true">
        {confirmed && (
          <span>
            <i className="mini-week-block" data-kind="neutral" data-role="plan" />
            Confirmed
          </span>
        )}
        <span>
          <i className="mini-week-block" data-kind="neutral" data-role="shortlist" />
          Shortlisted
        </span>
        <span>
          <i className="mini-week-block" data-kind="neutral" data-role="ghost" />
          Preview
        </span>
      </div>
    </>
  );
}

function Ghost({ ghost, clashes, win }: { ghost: MiniItem; clashes: MiniItem[]; win: { start: number; end: number } }) {
  const geo = geometry(ghost.course, win);
  if (!geo.visible) return null;
  const overlapping = [...new Set(clashes.map((c) => c.code))];
  return (
    <div
      className="mini-week-block"
      data-kind={ghost.kind}
      data-role="ghost"
      role="img"
      aria-label={`Preview: ${ghost.code} ${ghost.title}, ${meetingLabel(ghost.course)}${overlapping.length ? `, overlaps ${overlapping.join(", ")}` : ""}`}
      title={`${ghost.code} · ${meetingLabel(ghost.course)}`}
      style={{
        top: geo.top,
        height: geo.height,
        left: clashes.length ? "calc(50% + 1px)" : "2px",
        width: clashes.length ? "calc(50% - 3px)" : "calc(100% - 4px)",
      }}
    />
  );
}
