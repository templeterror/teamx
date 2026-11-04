/*
 * The two prerequisite lists on a course page, shared by Your courses on /plan and
 * the Drill-in on /find so the pages read the same.
 * - UnlockList: "Prerequisite for", code and title in two columns.
 * - PrerequisiteList: one entry per AND group, its options joined with "or", and how
 *   the student's record meets it. Only a missing group stands out.
 */

import { Fragment } from "react";
import { prereqStateLabel, type PrereqGroup, type Unlock } from "./catalog";
import "./prerequisites.css";

export function UnlockList({ unlocks, planned }: { unlocks: Unlock[]; planned: ReadonlySet<string> }) {
  return (
    <ul className="courselist">
      {unlocks.map((u) => {
        const note = [u.role === "option" ? "One of several accepted courses" : null, planned.has(u.code) ? "In your plan" : null]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={u.code}>
            <b className="courselist-code">{u.code}</b>{" "}
            <span className="courselist-title">
              {u.title}
              {note && (
                <small>
                  <span className="courselist-sr">, </span>
                  {note}
                </small>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function PrerequisiteList({ groups }: { groups: PrereqGroup[] }) {
  return (
    <ul className="reqlist">
      {groups.map((group, i) => {
        const label = prereqStateLabel(group.state);
        const only = group.options.length === 1 ? group.options[0] : null;
        return (
          <li key={i} data-state={group.state}>
            <span className="reqlist-opts">
              {!label && <span className="reqlist-needs">Needs </span>}
              {group.options.map((o, j) => (
                <Fragment key={j}>
                  {j > 0 && (j === group.options.length - 1 ? ` ${group.join} ` : ", ")}
                  <span className="reqlist-code" data-met={o.met || undefined}>
                    {o.label}
                  </span>
                </Fragment>
              ))}
              {only?.title && <span className="reqlist-title"> {only.title}</span>}
            </span>
            {label && (
              <>
                <span className="courselist-sr">, </span>
                <span className="reqlist-state">{label}</span>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
