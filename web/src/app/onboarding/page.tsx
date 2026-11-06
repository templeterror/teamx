import type { Metadata } from "next";
import { Suspense } from "react";
import { Onboarding } from "@/components/onboarding/onboarding";
import { currentProfile } from "@/components/student/profile-cookie";
import { profileFor } from "@/components/student/student";
import "./../../components/plan/plan.css";

export const metadata: Metadata = {
  title: "Plan setup · Course Planner",
};

/*
 * Plan setup, after sign-in and from the top bar's student menu. Outside the workspace
 * on purpose: no top bar, one question at a time, and it ends on the four-year plan.
 */
export default function OnboardingPage() {
  return (
    <div className="plan">
      <Suspense fallback={null}>
        <SignedIn />
      </Suspense>
    </div>
  );
}

/*
 * The signed-in profile comes from its cookies (Cache Components: inside Suspense). Keyed by
 * who, so a switch starts fresh, but not by the new student's program: choosing a major
 * re-renders this page with the other program and must keep the step the student is on.
 */
async function SignedIn() {
  const profile = await currentProfile();
  return <Onboarding key={profileFor(profile).id} signedIn={profile} />;
}
