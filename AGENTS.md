# Team X

Temple course planner. The data covers two programs: Computer Science BS (`ST-CSCI-BS`, the demo student's program) and Management Information Systems BBA (`BU-MIS-BBA`). Course facts come from the 2026–2027 bulletin; section meeting times, instructors, section numbers and campus are placeholders.

## Design

Product decisions from the working session are in `productthink.md`. Read it before designing or building a screen.

Keep the Banner registration sequence: select a term, keep plans of sections, search classes, check the week, then register. Do not copy Banner’s visual design.

Design lives in the Figma file [Course Planner](https://www.figma.com/design/eilqk01KI55KLLocNLQdxt/Course-Planner) before it is built in `web`. Before starting any new screen, flow, or visual change, ask whether it should go in that Figma file or directly in code, and wait for the answer.

## By date

Before the data is validated, work in `web` on the mock JSON. No API, Supabase, or requirement-rule logic.

- Design system and user flows
- Search with preloaded results, plus free-form search
- Flowchart of how requirements connect
- Registered / planned panel
- Course details expand in place, not modals
- Weekly schedule, drag from search
- One-page PDF export
- AI panel layout only

No Rate My Professors.

By November 3, 2026: that interface. Data collection and modelling are dated this day and still wait until the data is validated.

By November 6, 2026, after the data is validated:

- Embedded AI agent that answers questions and builds a plan from a natural-language query
- Registration and schedule history
- Onboarding from year, major, and student data
- Free-elective matching
- Career overlap

## Data

Import `web/src/data`. Do not copy course lists into components. Source is the 2026–2027 bulletin.

- `courses.json` — course cards and prerequisites, shared by both programs
- `program.json` — CS BS requirement tree
- `academic-plan.json` — CS BS eight-semester plan
- `mis-program.json` — MIS BBA requirement tree; `needsReview` lists bulletin contradictions left unresolved on purpose
- `mis-academic-plan.json` — MIS BBA eight-semester plan
- `student-record.json` — the demo student's real DARS audit (no ID, grades or GPA; the repo is public)
- `mis-student-record.json` — Allegra, the MIS BBA profile: her real DARS audit (Marketing minor; no ID, grades, GPA or last name; the repo is public)
- `sections.json` — placeholder meetings, Monday/Wednesday/Friday or Tuesday/Thursday
- `web/scripts/build_mock_data.py` — rebuilds the JSON

## Design exploration

For redesigning a component, use the `rafiat-design-exploration` skill.
