"use client";

/*
 * A select-only combobox (WAI-ARIA APG pattern). Focus stays on the trigger; the
 * listbox follows it with aria-activedescendant. The menu stays mounted and hidden
 * so it can scale out as well as in, and so its height can be measured to flip.
 * An empty value is the unset choice ("Any level") and reads tertiary.
 */

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import "./select.css";

export type SelectOption = { value: string; label: string };

export type SelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /* Lands on the trigger, so a caller can focus it. */
  id?: string;
  className?: string;
};

type Placement = { side: "bottom" | "top"; align: "start" | "end"; maxHeight: number };

const GAP = 4;
const EDGE = 8;
const MAX_HEIGHT = 296;
const PAGE = 10;
const TYPEAHEAD_MS = 500;

function isPrintable(e: KeyboardEvent) {
  return e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
}

export function Select({ label, value, onChange, options, id, className }: SelectProps) {
  const uid = useId();
  const triggerId = id ?? `${uid}-trigger`;
  const labelId = `${uid}-label`;
  const listId = `${uid}-list`;
  const optionId = (i: number) => `${uid}-option-${i}`;

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: "", time: 0 });
  const centerOnOpen = useRef(false);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [placement, setPlacement] = useState<Placement>({ side: "bottom", align: "start", maxHeight: MAX_HEIGHT });

  const selectedIndex = options.findIndex((o) => o.value === value);
  const last = options.length - 1;

  /* Below unless it would not fit and there is more room above; the end edge when the start would run off-screen. */
  function measure(): Placement {
    const trigger = triggerRef.current?.getBoundingClientRect();
    const list = listRef.current;
    if (!trigger || !list) return placement;
    const want = Math.min(list.scrollHeight, MAX_HEIGHT);
    const below = window.innerHeight - trigger.bottom - GAP - EDGE;
    const above = trigger.top - GAP - EDGE;
    const side = below >= want || below >= above ? "bottom" : "top";
    const room = side === "bottom" ? below : above;
    const width = Math.max(list.offsetWidth, trigger.width);
    const align = trigger.left + width > document.documentElement.clientWidth - EDGE ? "end" : "start";
    return { side, align, maxHeight: Math.max(120, Math.min(MAX_HEIGHT, room)) };
  }

  function openAt(index: number) {
    setPlacement(measure());
    setActive(Math.max(0, Math.min(last, index)));
    centerOnOpen.current = true;
    setOpen(true);
  }

  function close() {
    setOpen(false);
    typeahead.current.text = "";
  }

  function commit(index: number) {
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
    close();
  }

  /*
   * Labels starting with what was typed in the last half second. One letter, or the
   * same letter again, cycles from the option after the current one ("M", "M").
   */
  function findTyped(char: string, from: number): number {
    const t = typeahead.current;
    const now = Date.now();
    t.text = now - t.time > TYPEAHEAD_MS ? char : t.text + char;
    t.time = now;
    const text = t.text.toLowerCase();
    const repeated = [...text].every((c) => c === text[0]);
    const needle = repeated ? text[0] : text;
    const start = repeated ? from + 1 : Math.max(from, 0);
    for (let k = 0; k < options.length; k++) {
      const i = (start + k) % options.length;
      if (options[i].label.toLowerCase().startsWith(needle)) return i;
    }
    return -1;
  }

  function typing() {
    return typeahead.current.text !== "" && Date.now() - typeahead.current.time <= TYPEAHEAD_MS;
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const current = selectedIndex >= 0 ? selectedIndex : 0;

    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openAt(current);
      } else if (e.key === "Home") {
        e.preventDefault();
        openAt(0);
      } else if (e.key === "End") {
        e.preventDefault();
        openAt(last);
      } else if (isPrintable(e)) {
        e.preventDefault();
        const match = findTyped(e.key, current);
        openAt(match >= 0 ? match : current);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(last, i + 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        if (e.altKey) commit(active);
        else setActive((i) => Math.max(0, i - 1));
        return;
      case "Home":
        e.preventDefault();
        setActive(0);
        return;
      case "End":
        e.preventDefault();
        setActive(last);
        return;
      case "PageDown":
        e.preventDefault();
        setActive((i) => Math.min(last, i + PAGE));
        return;
      case "PageUp":
        e.preventDefault();
        setActive((i) => Math.max(0, i - PAGE));
        return;
      case "Enter":
        e.preventDefault();
        commit(active);
        return;
      case "Escape":
        /* Ours, not the page's: an open menu is the only thing Escape closes. */
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      case "Tab":
        close();
        return;
    }

    if (e.key === " " && !typing()) {
      e.preventDefault();
      commit(active);
      return;
    }
    if (isPrintable(e)) {
      e.preventDefault();
      const match = findTyped(e.key, active);
      if (match >= 0) setActive(match);
    }
  }

  /* Keep the highlighted option in view; on open, centre the selected one in the list. */
  useEffect(() => {
    const list = listRef.current;
    const option = list?.children[active] as HTMLElement | undefined;
    if (!open || !list || !option) return;
    if (centerOnOpen.current) {
      centerOnOpen.current = false;
      list.scrollTop = option.offsetTop - (list.clientHeight - option.offsetHeight) / 2;
      return;
    }
    const pad = 4;
    if (option.offsetTop < list.scrollTop + pad) list.scrollTop = option.offsetTop - pad;
    else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight - pad)
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight + pad;
  }, [open, active]);

  /* A press anywhere outside closes it, also where the press does not move focus. */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className={className ? `ui-select ${className}` : "ui-select"}>
      <span id={labelId} className="ui-select-label" onClick={() => triggerRef.current?.focus()}>
        {label}
      </span>
      <div className="ui-select-anchor">
        <div
          ref={triggerRef}
          id={triggerId}
          role="combobox"
          tabIndex={0}
          className="ui-select-trigger"
          aria-labelledby={labelId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open ? optionId(active) : undefined}
          data-empty={value === "" || undefined}
          onClick={() => (open ? close() : openAt(selectedIndex >= 0 ? selectedIndex : 0))}
          onKeyDown={onKeyDown}
          onBlur={close}
        >
          {/* Every label in one cell, all but the current one hidden: the widest sets the width, so picking never shifts the row. */}
          <span className="ui-select-value">
            {options.map((o, i) => (
              <span key={o.value} aria-hidden={i !== selectedIndex || undefined}>
                {o.label}
              </span>
            ))}
          </span>
          <svg
            className="ui-select-chevron"
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
        </div>

        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
          className="ui-select-menu"
          data-open={open || undefined}
          data-side={placement.side}
          data-align={placement.align}
          style={{ "--ui-select-max-height": `${placement.maxHeight}px` } as CSSProperties}
          /* Keeps focus on the trigger while the pointer picks. */
          onMouseDown={(e) => e.preventDefault()}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              id={optionId(i)}
              role="option"
              aria-selected={i === selectedIndex}
              className="ui-select-option"
              data-active={(open && i === active) || undefined}
              onPointerMove={() => {
                if (i !== active) setActive(i);
              }}
              onClick={() => commit(i)}
            >
              <span className="ui-select-option-label">{o.label}</span>
              <svg
                className="ui-select-check"
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
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
