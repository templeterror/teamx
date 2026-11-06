#!/usr/bin/env node
/*
 * Prints the four-year board (src/components/four-year/board.ts) for every profile:
 * autoPlace's terms and cards, sequencing issues, and graduation progress, then
 * Allegra's board with MIS 4596 moved to the tray and with summers on. Last, the new
 * student in each major, checked: every required card placed, no course before its
 * prerequisites, and a graduation term. Exits 1 if a check fails.
 * Same loader as check-progress.mjs; Node 22.6+.
 *
 *   node --no-warnings web/scripts/check-four-year.mjs
 */
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const src = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src") + "/").href;
const hooks = `
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const SRC = ${JSON.stringify(src)};
export async function resolve(specifier, context, next) {
  let target = specifier.startsWith("@/") ? new URL(specifier.slice(2), SRC).href : specifier;
  if (target.startsWith("file:") || target.startsWith(".")) {
    const url = new URL(target, context.parentURL);
    if (!/\\.[a-z]+$/.test(url.pathname)) {
      if (existsSync(fileURLToPath(url) + ".ts")) url.pathname += ".ts";
      else if (existsSync(fileURLToPath(url) + "/index.ts")) url.pathname += "/index.ts";
    }
    return next(url.href, context);
  }
  return next(target, context);
}
export async function load(url, context, next) {
  if (url.endsWith(".json")) {
    return { format: "module", source: "export default " + readFileSync(fileURLToPath(url), "utf8"), shortCircuit: true };
  }
  return next(url, context);
}
`;
register("data:text/javascript," + encodeURIComponent(hooks));

const board = await import(new URL("components/four-year/board.ts", src).href);
const { graduationProgress } = await import(new URL("components/progress/progress.ts", src).href);

function show(title, profile, prefs, moves = {}, choices = {}, start = null) {
  const model = board.modelFor(profile, start);
  const t0 = performance.now();
  const auto = board.autoPlace(model, prefs, choices);
  const ms = Math.round(performance.now() - t0);
  const b = board.resolveBoard(model, prefs, auto, moves);
  const progress = graduationProgress(model.program, model.record, b.placed);
  console.log(`\n== ${title}  (autoPlace ${ms} ms)`);
  console.log("open terms:", b.openTerms.join(", "), "| goal", b.goal);
  for (const term of [...b.openTerms, board.TRAY]) {
    const here = b.cards.filter((c) => b.placement[c.id] === term);
    const credits = here.reduce((s, c) => s + c.credits, 0);
    console.log(`  ${term.padEnd(12)} ${String(credits).padStart(2)} cr`);
    for (const c of here) {
      const issue = b.issues.get(c.id);
      console.log(`     ${(c.code ?? "—").padEnd(9)} ${String(c.credits)}cr ${c.kind.padEnd(13)} ${c.title.slice(0, 34).padEnd(34)} | ${c.fills}${b.optional.has(c.id) ? " [optional]" : ""}${issue ? `  !! ${issue.state}: ${issue.text}` : ""}`);
    }
  }
  console.log(progress.summary, JSON.stringify(progress.totalCredits), "grad", progress.graduationTerm);
  for (const r of progress.requirements) {
    console.log(`  [${r.status.padEnd(11)}] ${r.label.slice(0, 40).padEnd(40)} missing ${r.missingCredits}`);
  }
  return { model, board: b, progress };
}

const prefs = { graduationTerm: "Spring 2028", creditsPerTerm: 15, summers: false };
show("Allegra, defaults", "allegra", prefs);
show("Allegra, MIS 4596 moved to the tray", "allegra", prefs, { "major.capstone#0.0": board.TRAY });
show("Allegra, summers on, 12 a term", "allegra", { ...prefs, summers: true, creditsPerTerm: 12 });
show("Allegra, goal Fall 2027", "allegra", { ...prefs, graduationTerm: "Fall 2027" });
show("Allegra, BA 4102 moved to Fall 2027 (prerequisites in the same term)", "allegra", prefs, { "fox.upper-foundation#2.0": "Fall 2027" });
show("Allegra, FIN 3901 chosen and MKTG 3509 in a new Fall 2028", "allegra", prefs, { "minor#2.1": "Fall 2028" }, { "fox.upper-foundation#0.0": "FIN 3901" });
show("Rafiat, defaults", "rafiat", prefs);
const allegra = board.modelFor("allegra");
console.log("\nAllegra history kinds:");
for (const t of allegra.history) console.log(" ", t.name, t.status, t.credits, t.courses.map((c) => `${c.code}:${c.kind}`).join(" "));

/*
 * The new student: no record, so every requirement is a card, laid out from the start
 * term with the defaults setup gives (four years, the lightest load that fits them).
 */
const { defaultPreferences } = await import(new URL("components/onboarding/preferences.ts", src).href);
let failed = false;
function check(label, ok, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`);
  if (!ok) failed = true;
}
for (const key of ["new:ST-CSCI-BS", "new:BU-MIS-BBA"]) {
  const defaults = defaultPreferences(key);
  for (const start of ["Spring 2027", "Fall 2027"]) {
    const goal = start === defaults.startTerm ? defaults.graduationTerm : start === "Fall 2027" ? "Spring 2031" : defaults.graduationTerm;
    const prefs = { graduationTerm: goal, creditsPerTerm: defaults.creditsPerTerm, summers: false };
    const { model, board: b, progress } = show(`New student ${key.slice(4)}, starts ${start}, ${prefs.creditsPerTerm} a term`, key, prefs, {}, {}, start);
    const tray = b.cards.filter((c) => b.placement[c.id] === board.TRAY && !b.optional.has(c.id));
    const order = [...b.issues].filter(([, issue]) => issue.state === "missing");
    check("record is empty", model.record.terms.length === 0 && model.recordCredits === 0 && progress.totalCredits.done === 0);
    check("first open term is the start term", b.openTerms[0] === start, b.openTerms[0]);
    check("every required card placed", tray.length === 0, tray.map((c) => c.code ?? c.fills).join(", "));
    check("no course before its prerequisites", order.length === 0, order.map(([id, issue]) => `${id} ${issue.text}`).join("; "));
    check("graduation term reported", progress.onTrack && !!progress.graduationTerm, `${progress.graduationTerm} (goal ${b.goal})`);
    const perTerm = b.openTerms.map((term) => `${term} ${b.cards.filter((c) => b.placement[c.id] === term).reduce((sum, c) => sum + c.credits, 0)}`);
    console.log("  credits per term:", perTerm.join(" | "));
  }
}
if (failed) {
  console.error("\nA new-student check failed.");
  process.exit(1);
}
