#!/usr/bin/env node
/*
 * Prints Allegra's graduation progress from src/components/progress/progress.ts:
 * (a) nothing placed on the board, (b) every open slot placed in Fall 2027 / Spring 2028,
 * plus Rafiat's with nothing placed. No test framework: run it with Node 22.6+, which
 * strips TypeScript types; the hooks below resolve "@/" and JSON imports the way Next does.
 *
 *   node --no-warnings web/scripts/check-progress.mjs
 *
 * (--no-warnings hides Node's note that web/package.json has no "type": "module".)
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

const { graduationProgress, openSlots } = await import(new URL("components/progress/progress.ts", src).href);
const { misStudentRecord, studentRecord } = await import(new URL("data/index.ts", src).href);
const { courses } = await import(new URL("data/index.ts", src).href);

function print(title, progress) {
  console.log(`\n== ${title}`);
  console.log(progress.summary);
  console.log("credits", JSON.stringify(progress.totalCredits), "onTrack", progress.onTrack, "graduationTerm", progress.graduationTerm);
  for (const r of progress.requirements) {
    const missing = r.missing.map((m) => `${m.label} (${m.credits})`).join("; ");
    const by = r.satisfiedBy.map((s) => `${s.code}${s.state === "completed" ? "" : `:${s.state}`}`).join(", ");
    console.log(
      `  [${r.status.padEnd(11)}] ${r.group.padEnd(10)} ${r.id.padEnd(40)} req ${String(r.required.credits).padStart(2)}`
      + ` done ${String(r.done).padStart(2)} ip ${String(r.inProgress).padStart(2)} plan ${String(r.planned).padStart(2)}`
      + ` miss ${String(r.missingCredits).padStart(2)}${missing ? `  missing: ${missing}` : ""}${by ? `  by: ${by}` : ""}`,
    );
  }
}

const slots = openSlots("BU-MIS-BBA", misStudentRecord);
console.log("== Allegra openSlots");
for (const slot of slots) {
  console.log(`  ${slot.id.padEnd(46)} ${slot.kind.padEnd(13)} ${String(slot.credits).padStart(2)} cr  ${slot.label}  -> ${slot.options[0] ?? "(none)"}${slot.options.length > 1 ? ` (+${slot.options.length - 1})` : ""}${slot.pool ? "  pool" : ""}`);
}

print("Allegra, nothing placed", graduationProgress("BU-MIS-BBA", misStudentRecord, []));

/* Every slot's default, alternating Fall 2027 / Spring 2028; the capstone last. */
const placed = slots.map((slot, index) => ({
  code: slot.options[0],
  credits: courses[slot.options[0]]?.credits.value ?? slot.credits,
  term: slot.requirement === "major.capstone" || index % 2 ? "Spring 2028" : "Fall 2027",
  slot: slot.id,
})).filter((course) => course.code);
console.log("\nplaced:", placed.map((p) => `${p.code} ${p.term}`).join(", "));
print("Allegra, every open slot placed", graduationProgress("BU-MIS-BBA", misStudentRecord, placed));

/* The minor and the named courses only, no business-elective cards: the minor's MKTG courses count as business electives too. */
const noElectives = placed.filter((course) => !course.slot.startsWith("fox.upper-foundation.business-electives"));
print("Allegra, no business-elective cards (minor overlap)", graduationProgress("BU-MIS-BBA", misStudentRecord, noElectives));

print("Rafiat, nothing placed", graduationProgress("ST-CSCI-BS", studentRecord, []));
console.log("\nRafiat openSlots:", openSlots("ST-CSCI-BS", studentRecord).map((s) => `${s.label} -> ${s.options[0] ?? "(none)"}`).join(" | "));
