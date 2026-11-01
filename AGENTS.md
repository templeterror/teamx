# Team X

Temple course planner. The mock data is the Computer Science BS only.

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

- `courses.json` — course cards and prerequisites
- `program.json` — requirement tree
- `academic-plan.json` — eight-semester plan
- `sections.json` — placeholder meetings, Monday/Wednesday/Friday or Tuesday/Thursday
- `web/scripts/build_mock_data.py` — rebuilds the JSON
