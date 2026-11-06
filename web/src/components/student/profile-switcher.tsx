"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { startNewStudent, switchProfile } from "./actions";
import { forgetNewStudent } from "./new-student";
import { PROFILES, type Profile } from "./student";
import "./profile-switcher.css";

/*
 * The top bar's student block, as a menu button (WAI-ARIA APG menu button with radio
 * items): the person signed in, and a short menu of every profile with the current one
 * checked. Focus moves into the menu and roves with the arrow keys; Escape closes it and
 * returns focus to the button; a press outside or Tab closes it.
 *
 * Choosing the other profile runs switchProfile, which only sets the cookie. The server
 * re-renders this page as the other person (see actions.ts), so the URL stays put and
 * nothing renders from the client's guess first.
 *
 * The new student is listed only while signed in as them (it is whoever "+ New student"
 * last started). Below the profiles, two more items that rove with the others:
 * "+ New student", which clears the new student's saved state in both programs and opens
 * plan setup for a fresh one (startNewStudent), and Plan setup (/onboarding), the way
 * back into onboarding for this profile.
 */

/* The new top bar mounts with the new profile; this tells its switcher to take focus back. */
let refocusPending = false;
function markRefocus() {
  refocusPending = true;
}
function takeRefocus() {
  const pending = refocusPending;
  refocusPending = false;
  return pending;
}

/* "RA", "A": the phone-width badge. Only letters of the name on file. */
function initials(name: string) {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ProfileSwitcher({
  current,
  onBeforeSwitch,
}: {
  current: Profile;
  /* Runs before the cookie changes, while this profile's plan is still mounted (PlanShell parks it). */
  onBeforeSwitch: () => void;
}) {
  const uid = useId();
  const menuId = `${uid}-menu`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();

  const profiles = current.isNew ? [...PROFILES, current] : PROFILES;
  const currentIndex = Math.max(
    0,
    profiles.findIndex((p) => p.key === current.key),
  );
  /* The profiles, then + New student, then Plan setup. */
  const newIndex = profiles.length;
  const last = newIndex + 1;

  function openAt(index: number) {
    setActive(index);
    setOpen(true);
  }

  function close({ refocus }: { refocus: boolean }) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function choose(profile: Profile) {
    close({ refocus: true });
    if (profile.key === current.key) return;
    onBeforeSwitch();
    markRefocus();
    startTransition(() => switchProfile(profile.id));
  }

  /* Park this plan, forget the old new student, then sign in as a fresh one and open plan setup. */
  function startOver() {
    close({ refocus: false });
    onBeforeSwitch();
    forgetNewStudent();
    startTransition(() => startNewStudent());
  }

  /* Focus follows the active item while open. */
  useEffect(() => {
    if (open) itemRefs.current[active]?.focus();
  }, [open, active]);

  /* After a switch the whole bar is new; put focus back where the person left it. */
  useEffect(() => {
    if (takeRefocus()) triggerRef.current?.focus();
  }, []);

  /* A press anywhere outside closes it, also where the press does not move focus. */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    /* Enter and Space arrive as a click; the arrows open on the current or the last item. */
    if (e.key === "ArrowDown") {
      e.preventDefault();
      openAt(currentIndex);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openAt(last);
    }
  }

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => (i === last ? 0 : i + 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => (i === 0 ? last : i - 1));
        return;
      case "Home":
        e.preventDefault();
        setActive(0);
        return;
      case "End":
        e.preventDefault();
        setActive(last);
        return;
      case "Escape":
        /* Ours, not the page's: an open menu is the only thing Escape closes. */
        e.preventDefault();
        e.stopPropagation();
        close({ refocus: true });
        return;
      case "Tab":
        close({ refocus: false });
        return;
    }
  }

  return (
    <div ref={rootRef} className="plan-topbar-student">
      <button
        ref={triggerRef}
        type="button"
        className="profile-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-busy={pending || undefined}
        onClick={() => (open ? close({ refocus: false }) : openAt(currentIndex))}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="profile-badge" aria-hidden="true">
          {initials(current.name)}
        </span>
        <span className="profile-trigger-text">
          {current.name}
          <small>{current.programLabel}</small>
        </span>
        <svg
          className="profile-chevron"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>

      {/* Always mounted, hidden while closed, so it can fade out as well as in. */}
      <div
        id={menuId}
        role="menu"
        aria-label="Student"
        className="profile-menu"
        data-open={open || undefined}
        onKeyDown={onMenuKeyDown}
      >
        {profiles.map((p, i) => (
          <button
            key={p.key}
            ref={(node) => {
              itemRefs.current[i] = node;
            }}
            type="button"
            role="menuitemradio"
            aria-checked={p.key === current.key}
            tabIndex={i === active ? 0 : -1}
            className="profile-option"
            onClick={() => choose(p)}
            onPointerMove={() => {
              if (open && i !== active) setActive(i);
            }}
          >
            <span>
              {p.name}
              <small>{p.programLabel}</small>
            </span>
            <svg
              className="profile-check"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m3.5 8.5 3 3 6-7" />
            </svg>
          </button>
        ))}
        <div role="separator" className="profile-menu-separator" />
        <button
          ref={(node) => {
            itemRefs.current[newIndex] = node;
          }}
          type="button"
          role="menuitem"
          tabIndex={newIndex === active ? 0 : -1}
          className="profile-option profile-setup"
          onClick={startOver}
          onPointerMove={() => {
            if (open && newIndex !== active) setActive(newIndex);
          }}
        >
          <span>
            + New student
            <small>Start over with no courses</small>
          </span>
        </button>
        <Link
          ref={(node) => {
            itemRefs.current[last] = node;
          }}
          href="/onboarding"
          role="menuitem"
          tabIndex={last === active ? 0 : -1}
          className="profile-option profile-setup"
          onClick={() => close({ refocus: false })}
          onPointerMove={() => {
            if (open && last !== active) setActive(last);
          }}
        >
          <span>
            Plan setup
            <small>Graduation term, credits, minor</small>
          </span>
        </Link>
      </div>
    </div>
  );
}
