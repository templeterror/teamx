import { clearEdits } from "@/components/four-year/edits";
import { resetPreferences } from "@/components/onboarding/preferences";
import { dropParkedPlan } from "@/components/plan/use-plan";
import { clearShortlist } from "@/components/plan/use-shortlist";
import { NEW_STUDENT_PROGRAMS, profileKey } from "./student";

/*
 * "+ New student" starts from nothing: every bit of the new student's saved state, in
 * both programs, goes (plan setup, four-year board edits, the shortlist, a parked plan).
 * Client only (storage). Rafiat's and Allegra's keys are never touched.
 */
export function forgetNewStudent() {
  for (const program of NEW_STUDENT_PROGRAMS) {
    const key = profileKey("new", program);
    resetPreferences(key);
    clearEdits("new", program);
    clearShortlist(key);
    dropParkedPlan(key);
  }
}
