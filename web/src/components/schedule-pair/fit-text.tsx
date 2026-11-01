"use client";

/*
 * Word-aware truncation for the calendar.
 *
 * CSS `text-overflow` and `line-clamp` cut at a character ("Programmi…") and
 * only know about width, so a short block can still slice a line in half.
 * These helpers measure the real box and the real font, then keep as many
 * whole words as fit, ending in a single "…" (U+2026). A word is never split.
 * When not even one word fits, the text steps down to a shorter fallback
 * (title → course code) or is left out, never clipped.
 */

import { useLayoutEffect, useRef, useState } from "react";

const ELLIPSIS = "…";

/* A title should not trail off on a connective: "Introduction…", not "Introduction to…". */
const WEAK_ENDINGS = new Set([
  "a", "an", "and", "the", "of", "to", "in", "for", "on", "at", "by", "with", "or", "&", "vs", "vs.",
]);

type Measure = (text: string) => number;

let probe: HTMLSpanElement | null = null;

/*
 * Measures text in a hidden span that copies the element's type settings.
 * A DOM probe (not canvas) so tabular figures, tracking and kerning match
 * exactly what the block renders.
 */
function measurerFor(el: HTMLElement): Measure {
  if (!probe) {
    probe = document.createElement("span");
    probe.setAttribute("aria-hidden", "true");
    Object.assign(probe.style, {
      position: "absolute",
      top: "0",
      left: "-9999px",
      visibility: "hidden",
      whiteSpace: "pre",
      pointerEvents: "none",
      contain: "layout style",
    });
    document.body.appendChild(probe);
  }
  const cs = getComputedStyle(el);
  const style = {
    font: cs.font,
    fontFamily: cs.fontFamily,
    fontWeight: cs.fontWeight,
    fontSize: cs.fontSize,
    letterSpacing: cs.letterSpacing,
    fontVariantNumeric: cs.fontVariantNumeric,
    fontFeatureSettings: cs.fontFeatureSettings,
    fontKerning: cs.fontKerning,
  };
  const cache = new Map<string, number>();
  return (text) => {
    let width = cache.get(text);
    if (width === undefined) {
      Object.assign(probe!.style, style);
      probe!.textContent = text;
      width = probe!.getBoundingClientRect().width;
      cache.set(text, width);
    }
    return width;
  };
}

function lineHeightOf(el: HTMLElement) {
  const cs = getComputedStyle(el);
  const lh = parseFloat(cs.lineHeight);
  return Number.isFinite(lh) ? lh : parseFloat(cs.fontSize) * 1.25;
}

/* Greedy wrap, same as the browser's default. A word wider than the line cannot be placed. */
function linesNeeded(words: string[], width: number, measure: Measure) {
  let lines = 1;
  let line = "";
  for (const word of words) {
    if (measure(word) > width) return Infinity;
    const next = line ? `${line} ${word}` : word;
    if (measure(next) <= width) line = next;
    else {
      lines += 1;
      line = word;
    }
  }
  return lines;
}

/** Longest whole-word prefix of `text` that fits `maxLines` × `width`, with "…" if shortened. */
export function fitWords(text: string, width: number, maxLines: number, measure: Measure) {
  if (maxLines < 1 || width <= 0) return null;
  const words = text.split(/\s+/).filter(Boolean);
  if (linesNeeded(words, width, measure) <= maxLines) return text;
  for (let k = words.length - 1; k >= 1; k -= 1) {
    const head = words.slice(0, k);
    const last = head[k - 1];
    if (k > 1 && WEAK_ENDINGS.has(last.toLowerCase())) continue;
    const stem = last.replace(/[\s:;,.\-–—]+$/, "");
    if (!stem) continue;
    const candidate = [...head.slice(0, -1), stem + ELLIPSIS];
    if (linesNeeded(candidate, width, measure) <= maxLines) return candidate.join(" ");
  }
  return null;
}

type BlockFit = { title: string | null; meta: string | null };

/**
 * Lays out a calendar block: as much title as fits, then one meta line.
 * Priority: some title > meta line > more title lines.
 */
export function BlockText({
  title,
  code,
  time,
}: {
  title: string;
  code: string;
  time: string;
}) {
  const bodyRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const metaRef = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState<BlockFit | null>(null);
  /* Extra px shaved off the width if the browser wraps tighter than the canvas predicted. */
  const [slack, setSlack] = useState(0);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    const titleEl = titleRef.current;
    const metaEl = metaRef.current;
    if (!body || !titleEl || !metaEl) return;

    const run = () => {
      const width = body.clientWidth - 1 - slack;
      const height = body.clientHeight;
      const gap = parseFloat(getComputedStyle(body).rowGap) || 0;
      const tMeasure = measurerFor(titleEl);
      const mMeasure = measurerFor(metaEl);
      const tLine = lineHeightOf(titleEl);
      const mLine = lineHeightOf(metaEl);

      const metaChoice =
        [`${code} · ${time}`, time, code].find((m) => mMeasure(m) <= width) ?? null;
      const linesFor = (room: number) => Math.min(4, Math.floor((room + 0.5) / tLine));

      const attempt = (meta: string | null): BlockFit | null => {
        const room = height - (meta ? mLine + gap : 0);
        const lines = linesFor(room);
        const t = fitWords(title, width, lines, tMeasure) ?? fitWords(code, width, lines, tMeasure);
        return t ? { title: t, meta } : null;
      };

      const next =
        attempt(metaChoice) ??
        attempt(null) ?? {
          title: null,
          meta: metaChoice && mLine <= height ? metaChoice : null,
        };
      setFit((prev) => (prev && prev.title === next.title && prev.meta === next.meta ? prev : next));
    };

    run();
    const observer = new ResizeObserver(run);
    observer.observe(body);
    document.fonts?.ready.then(run);
    return () => observer.disconnect();
  }, [title, code, time, slack]);

  /* Safety net: if the real wrap overflowed, tighten and lay out again (bounded). */
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!fit || !body || slack >= 12) return;
    if (body.scrollHeight > body.clientHeight + 0.5) setSlack((s) => s + 4);
  }, [fit, slack]);

  const shownTitle = fit ? fit.title : title;
  const shownMeta = fit ? fit.meta : `${code} · ${time}`;

  return (
    <span className="sp-block-body" ref={bodyRef}>
      <span className="sp-block-name" ref={titleRef} hidden={shownTitle === null}>
        {shownTitle}
      </span>
      <span className="sp-block-meta" ref={metaRef} hidden={shownMeta === null}>
        {shownMeta}
      </span>
    </span>
  );
}

/** One line that steps down through `options` (longest first) until one fits whole. */
export function FitLine({ options, className }: { options: string[]; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState<string | null>(options[0] ?? null);
  const key = options.join("\u0000");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const choices = key.split("\u0000");
    const run = () => {
      const measure = measurerFor(el);
      const width = el.clientWidth - 1;
      setShown(choices.find((o) => measure(o) <= width) ?? null);
    };
    run();
    const observer = new ResizeObserver(run);
    observer.observe(el);
    document.fonts?.ready.then(run);
    return () => observer.disconnect();
  }, [key]);

  return (
    <span className={className} ref={ref}>
      {shown ?? " "}
    </span>
  );
}
