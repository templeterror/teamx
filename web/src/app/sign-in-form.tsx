"use client";

import { useState } from "react";
import { chooseProfile } from "@/components/student/actions";
import { DEFAULT_PROFILE, NEW_STUDENT_NAME, PROFILES, profileFor, type ProfileId } from "@/components/student/student";

/*
 * The mock sign-in's form. Client-side only so the email follows the chosen profile:
 * Rafiat's address for Rafiat, and an empty field for Allegra and the new student, who
 * have none on file. The new student comes last and picks a program in setup.
 * Like any sign-in it starts on the default, Rafiat, rather than reading the last choice
 * back, so no saved choice can swap in under the pointer.
 */
export function SignInForm() {
  const [chosen, setChosen] = useState<ProfileId>(DEFAULT_PROFILE);
  const email = chosen === "new" ? null : profileFor(chosen).email;

  return (
    <form className="gate-form" action={chooseProfile}>
      <label className="field">
        <span>Email</span>
        <input
          type="email"
          value={email ?? ""}
          placeholder="Temple email"
          autoComplete="username"
          spellCheck={false}
          readOnly
        />
      </label>
      <label className="field">
        <span>Password</span>
        <input type="password" defaultValue="password" readOnly />
      </label>
      {/*
       * Radios rather than a select: "Management Information Systems · BBA" does not
       * fit a 440px select without truncating, and three choices read best in a list
       * anyway. Each row is a real label around its radio.
       */}
      <fieldset className="gate-choice">
        <legend>Student</legend>
        {PROFILES.map((p) => (
          <label key={p.id}>
            <input
              type="radio"
              name="profile"
              value={p.id}
              checked={p.id === chosen}
              onChange={() => setChosen(p.id)}
            />
            <span>
              {p.name}
              <small>{p.programLabel}</small>
            </span>
          </label>
        ))}
        <label>
          <input
            type="radio"
            name="profile"
            value="new"
            checked={chosen === "new"}
            onChange={() => setChosen("new")}
          />
          <span>
            {NEW_STUDENT_NAME}
            <small>No courses yet · choose a program next</small>
          </span>
        </label>
      </fieldset>
      <button type="submit" className="btn-primary">
        Continue
      </button>
    </form>
  );
}
