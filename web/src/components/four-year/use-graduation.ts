"use client";

import { useMemo } from "react";
import { graduationProgress } from "@/components/progress/progress";
import { usePlanContext } from "@/components/plan/plan-shell";
import { useProfile } from "@/components/student/student-context";
import { usePreferences } from "@/components/onboarding/preferences";
import { autoPlace, modelFor, resolveBoard, type RecordItem } from "./board";
import { useEdits } from "./edits";

/*
 * The four-year board and graduation progress for the active profile, read-only: the same
 * inputs and steps as FourYearPlan (record, setup preferences, saved board edits, and the
 * term on /plan as registered), so /plan/review's progress rail matches /four-year.
 * Keep the two in step if either changes.
 */
export function useGraduation() {
  const { id: profileId, program, record } = useProfile();
  const model = modelFor(profileId);
  const prefs = usePreferences(profileId);
  const { edits } = useEdits(profileId, program);
  const { placements } = usePlanContext();

  const fromPlan = model.history.find((term) => term.fromPlan);
  const current: RecordItem[] = useMemo(() => fromPlan
    ? placements
        .filter((placement) => !placement.deferred && !placement.dropped)
        .map(({ kind, course }) => ({
          code: course.code,
          title: course.title,
          credits: course.credits,
          kind: model.fillsOf(course.code) ? model.kindOf(course.code) : kind,
          state: "registered" as const,
          fills: model.fillsOf(course.code),
        }))
    : [], [fromPlan, placements, model]);

  const prefsKey = `${prefs.graduationTerm}|${prefs.creditsPerTerm}|${prefs.summers}`;
  const auto = useMemo(
    () => autoPlace(model, prefs, edits.choices),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prefsKey stands for the three fields autoPlace reads
    [model, prefsKey, edits.choices],
  );
  const board = useMemo(
    () => resolveBoard(model, prefs, auto, edits.moves, current.map((course) => course.code)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as above
    [model, prefsKey, auto, edits.moves, current],
  );
  const progress = useMemo(() => {
    const recorded = new Set(model.record.terms.flatMap((term) => term.courses.map((course) => course.code)));
    const extra = fromPlan
      ? current.filter((course) => !recorded.has(course.code))
          .map((course) => ({ code: course.code, credits: course.credits, term: fromPlan.name }))
      : [];
    return graduationProgress(program, record, [...extra, ...board.placed]);
  }, [model, program, record, board.placed, current, fromPlan]);

  return { program, record, board, progress };
}
