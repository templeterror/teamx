"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { usePlan } from "@/components/plan/use-plan";
import { SchedulePair } from "@/components/schedule-pair/schedule-pair";
import { STATES, useFixture } from "./fixtures";
import "./workbench.css";

const WIDTHS = [
  { id: "wide", label: "Wide", px: 1280 },
  { id: "laptop", label: "Laptop", px: 1024 },
  { id: "narrow", label: "Narrow", px: 760 },
] as const;

/* Sidebar open/closed, remembered across reloads. */
const SIDEBAR_KEY = "wb-sidebar-collapsed";
const sidebarListeners = new Set<() => void>();
const sidebarStore = {
  subscribe(listener: () => void) {
    sidebarListeners.add(listener);
    window.addEventListener("storage", listener);
    return () => {
      sidebarListeners.delete(listener);
      window.removeEventListener("storage", listener);
    };
  },
  get: () => window.localStorage.getItem(SIDEBAR_KEY) === "1",
  set(collapsed: boolean) {
    window.localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
    sidebarListeners.forEach((l) => l());
  },
};

export function Workbench() {
  const [width, setWidth] = useState<(typeof WIDTHS)[number]["id"]>("wide");
  const px = WIDTHS.find((w) => w.id === width)!.px;
  const collapsed = useSyncExternalStore(sidebarStore.subscribe, sidebarStore.get, () => false);

  return (
    <div className="wb" data-collapsed={collapsed || undefined}>
      <aside className="wb-index" id="wb-sidebar">
        <div className="wb-index-top">
          {!collapsed && <p className="wb-label">Course Planner</p>}
          {/* Same button in both states, so focus stays put when it toggles. */}
          <button
            className="wb-toggle"
            aria-expanded={!collapsed}
            aria-controls="wb-sidebar-content"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => sidebarStore.set(!collapsed)}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2.5" y="3" width="13" height="12" rx="2.5" />
              <path d="M7 3v12" />
              {collapsed ? <path d="m10 7.5 1.5 1.5L10 10.5" /> : <path d="M12 7.5 10.5 9l1.5 1.5" />}
            </svg>
          </button>
        </div>
        {!collapsed && (
          <div className="wb-index-content" id="wb-sidebar-content">
            <h1>Components</h1>
            <nav aria-label="Components">
              <a href="#schedule-pair" aria-current="true">
                Weekly schedule + Your courses
              </a>
            </nav>
            <Link href="/plan" className="wb-back">
              Open /plan ↗
            </Link>
          </div>
        )}
      </aside>

      <main className="wb-main">
        <section id="schedule-pair" className="wb-component">
          <header className="wb-component-head">
            <div>
              <p className="wb-label">Component 01</p>
              <h2>Weekly schedule + Your courses</h2>
              <p>
                Always shown together. This is the same component /plan renders, shown here in
                fixed states so it can be designed and checked without clicking through the page.
              </p>
            </div>
            <div className="wb-widths" role="group" aria-label="Frame width">
              {WIDTHS.map((w) => (
                <button key={w.id} aria-pressed={width === w.id} onClick={() => setWidth(w.id)}>
                  {w.label} <span>{w.px}</span>
                </button>
              ))}
            </div>
          </header>

          <Frame name="Live" note="Wired to the real plan state. Starts all suggested; try Drop, Add, an Or swap, and Confirm plan." px={px}>
            <LivePair />
          </Frame>
          {STATES.map((state) => (
            <Frame key={state.id} name={state.name} note={state.note} px={px}>
              <FixturePair state={state} />
            </Frame>
          ))}
        </section>
      </main>
    </div>
  );
}

function Frame({
  name,
  note,
  px,
  children,
}: {
  name: string;
  note: string;
  px: number;
  children: React.ReactNode;
}) {
  return (
    <figure className="wb-frame">
      <figcaption>
        <strong>{name}</strong>
        <span>{note}</span>
      </figcaption>
      <div className="wb-stage">
        <div className="wb-canvas" style={{ width: `min(${px}px, 100%)` }}>
          {children}
        </div>
      </div>
    </figure>
  );
}

function LivePair() {
  const plan = usePlan();
  return <SchedulePair plan={plan} />;
}

function FixturePair({ state }: { state: (typeof STATES)[number] }) {
  const plan = useFixture(state.seeds);
  return (
    <SchedulePair
      plan={plan}
      defaultExpanded={state.expanded ?? null}
      initialConfirmed={state.confirmed ?? []}
      initialPreview={state.preview ?? null}
    />
  );
}
