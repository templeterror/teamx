# Product thinking

Captured 31 October 2026 from the working session on the Temple course planner. Read this before designing or building a screen. When a later decision changes something here, update this file.

## What this is

A 10-day MVP for an AI build competition at Temple. The aim is to win that competition with intelligence and design. It is a demo, scoped to the Computer Science BS and the 2026–2027 bulletin.

Temple’s current tools stay the contrast: Banner for registration, the TU portal Excel template, and the bulletin in another tab. Students already have the data. Nothing connects it, suggests a semester, or makes the remaining choices easy. Temple will not ship a redesigned flow or an embedded AI inside this competition window.

## The flow to keep

Keep Banner’s sequence. Select a term, keep plans of sections, search classes, check the week, then register. The visual design of Banner is not the target. Search, course descriptions, and the way requirements, sections, and the week fail to connect are the parts that feel broken.

Design work uses the Figma file [Course Planner](https://www.figma.com/design/eilqk01KI55KLLocNLQdxt/Course-Planner). Before starting a screen, ask whether it goes in that file or directly in code, and wait for the answer.

## Who the demo is for

The student in the seat is Rafiat, and since 3 November 2026 the app runs on Rafiat's real record (`web/src/data/student-record.json`, taken from a Temple DARS audit dated 31 October 2026). The file has courses, terms and credits only. The student ID, grades and GPA stay out of it because this repository is public.

- **Done:** 56 credits, Fall 2024 through Spring 2026.
- **Now:** Fall 2026 is in progress (17 credits).
- **Planning:** Spring 2027 is registered (16 credits). That registration is the plan the app opens with.
- **Left after spring:** 34 credits:
  - Data Structures and Algorithms (CIS 3223)
  - the capstone (CIS 4397 or 4398)
  - one more CIS elective credit
  - a lab science sequence
  - Intellectual Heritage I (IH 0951 for Honors)
  - free electives
  - three upper-level Honors courses
  - the UX/UI design minor (15 credits)
- **Catalog year:** the audit is on Fall 2025, while the app reads the 2026–2027 bulletin. Accept that gap for the demo.

Other students came up and are not the demo:

- Someone who wanted gen eds they would enjoy, with more options than an advisor had time to cover.
- A computer science student who was unsure about staying in the major, wanted a course that would answer that, and was pointed toward film, microeconomics, and philosophy.

Those stories explain the pain. The screen we build is the on-pace case.

## The job of the screen

One dashboard. The student arrives and about 75% of the plan is already made. The hard part they skip is finding information and placing core courses by hand. The part they still do is the real decision: which elective, and why, and which gen ed this requirement offers.

What is already filled:

- Core courses they have to take are on the plan. They can change them. Moving a writing-intensive course to senior year and loading more electives now has to stay easy.

What is left to decide:

- Major electives. Suggested, shown with a dotted treatment so they read as flexible. Any elective is allowed once its prerequisites are met, which finished cores usually cover. Swap them freely.
- One remaining gen ed. Show what that requirement still allows. Suggest one they might enjoy, or show a few options.

The screen holds the information those decisions need. It opens on a plan, not on an empty search.

## What the judge sees

Judges are often former Temple students. The demo shows today’s path first: registration, course search, the bulletin, the Excel template, about a minute. Then our dashboard, about 20 seconds, with the plan already 75% filled. The explanation after that covers the intelligence layer, how the data is modeled, how accurate the suggestions are, what the advisor is still for, and how the requirement connections give a course its context.

The 20 seconds have to work on the filled plan itself. The talk comes after.

## Build this, leave the rest thin

Build at full effort for the demo:

- The on-pace dashboard.
- Cores prefilled, and still movable.
- Suggested major electives, dotted, swappable.
- The one remaining gen ed, with the requirement’s options and a suggestion or a short list.

Leave thin until the on-pace screen is true:

- A student who is behind, missing a prerequisite, over the credit cap, or already late.
- Natural-language search as the thing the judge feels first.
- A graph as the whole product. Connections belong as context on a course.
- Free-elective taste from history when that history is empty.
- Chat as the way the gen ed gets chosen.
- Graduation-credit chrome that competes with the plan.

## Visual system

Set in the Figma file on the Foundations page, before any screen. White mode only. One collection, `Color`, mode `White`.

The neutrals are a cool gray, the temperature of Linear’s light UI. The accent is a clear red, `#B82F31`, in the same family as Temple cherry and light enough to read as red rather than maroon. It is the button, the link, and the elective label. Hover is the same hue, darker, `#852726`. Success and warning are separate, so a full section does not look like the accent.

The cool gray surfaces stay. On 3 November 2026, five surface treatments for Your plan were built and compared on the real page: Current, Tray (cool gray with more contrast), Paper (warm bulletin paper), Cherry (neutrals on the brand hue) and Flat (no shadows). Rafiat kept Current. One lesson from that round: any warm surface has to warm the text, chips and button fills at the same lightness too. Warm panels under cool contents read as unpolished. The audit is in `plan-surfaces-audit.md`.

Text colors are the steps that pass WCAG AA on white: primary, secondary, and tertiary. The lighter gray step is not a text color.

Two typefaces, changed 3 November 2026 in the pre-judging design pass. Source Serif 4 sets page headings and course titles at 17px and up, the voice of the bulletin the courses come from. Inter sets everything else: tables, calendar blocks, chips, buttons, labels. The serif never goes below 17px. Ten roles: Display, Title, Heading, Body, Body strong, UI, UI strong, Caption, Label, Number. Body and inputs are 16px. UI rows are 14px. Captions are 13px. Labels are 12px, uppercase, with open tracking. Display and title tracking is slightly tight. Numbers should use tabular figures on the layer. Figma text styles cannot store that feature.

## Layout

Decided from the dashboard prototype. The plan is the week. Open choices, the elective swaps, the gen ed, and moving the writing-intensive course, sit in a rail beside it.

Rejected: Ledger, a list with no week. A collision was only a sentence. Rejected: Split, the list and the week at equal weight. Denser than the week needed to be.

## Still open

- What the screen shows when a suggested course does not fit the week.
- Whether a judge understands the filled plan with nobody speaking.
- How this demo beats the other builds in the room.
- The other students were never named. The demo does not depend on them.

## Search experience — selected from /prototypes/search-experience

- Chosen: Section table, with course/section, meeting time, instructor/campus, plan status, and icon add/drop actions visible in aligned columns.
- Keep Search courses and Ask AI above results in the same planner page.
- Keep the existing Weekly schedule (WeekBoard) and Your courses (FocusCard) below search. Do not promote the prototype calendar or course list.
- Rejected: the compact current search hid too much information; Course + week was not selected.
- Integrate with the shared plan state; remove the exploration picker and variants.

## Your courses — selected from /proto/your-courses (1 November 2026)

- Chosen: **Cards**. Every course in the term is its own card: course code and credits on top (code in the category color), then the course title, then why it was picked, then meeting time. No requirement eyebrow: the category color and the week's legend already say core, elective, or gen ed.
- Major core courses use the same card as electives and gen eds. They are suggestions too: nothing arrives confirmed.
- Order: the choices (electives, gen ed) first, then major core.
- Alternatives are compact "Or" chips on the card. Hover peeks in the week, click pins a preview with what changes (meets, credits, conflicts) and Swap / Cancel.
- Each card has one **Add / Drop** button, the registration words students already use ("Drop" while the course is in the plan, "Add" once dropped). A dropped course keeps its place, dimmed, so Add is right where Drop was. "Take it later" sits beside it only where moving the course is allowed.
- Confirming is for the whole semester only: one red **Confirm plan** at the bottom. There is no per-course Confirm. Once confirmed, the footer becomes one row: a green check with "Plan confirmed" and an **Edit plan** button, which puts every course back to suggested and brings Confirm plan back. No helper sentences under either.
- Rejected: **Current** (a course list grouped by decision) read like catalog rows and hid the choice behind "1 other option". **Slots** (requirement with radio options side by side) compared best but was the tallest; the gen ed fell below the fold. **Checklist** (one line per course, checkbox) fit everything but hid the reasons and alternatives behind a disclosure, which is the part that sells the plan.
- Variant tried and changed: Cards first collapsed major core into one summary card with "Confirm both". Rejected: core courses are decisions too and should read the same way.

## Course details — selected from /proto/course-details (1 November 2026)

- Chosen: **Drill-in**. Tapping a course card (or its class in the week) slides the whole Your courses panel to that course's page; "‹ Your semester" slides back with the list's scroll kept. The week stays visible beside it with the course ringed. Clicking another class in the week switches pages.
- The page holds: code and credits, title, days and time; section, instructor, campus; About this course; **Prerequisite for** first, because what a course opens up matters more than what it needs (courses that list this one, marked when it is only one of several options, and when that course is also in the plan); then Prerequisites (courses with titles, then the bulletin's wording); Good to know (writing intensive, gen ed area, usually offered); Or take instead with Preview → Swap / Cancel; then Take it in a later term and Add / Drop.
- Drop lives only on the course page. Cards show code and credits, title, days and time, the Or chips, and a › to open.
- Motion: slide in 300ms, back 220ms, cubic-bezier(0.32, 0.72, 0, 1); none with reduced motion. Focus moves to the back button on open and returns to the card on back.
- Rejected: **Current** (no details anywhere, Drop on every card). **Inline** (the card grows in place): long descriptions made the open card very tall and pushed the rest of the plan and Confirm plan far away. **Sheet** (details rise over a dimmed list): read as a modal, which this project avoids, and covered the list as much as Drill-in did without the clean back navigation.

## Course finder — selected from /proto/search (1 November 2026), mixed from Bar and Rail

- Base: **Bar**. A one-row finder above the week: search field, four "Counts for" scope chips with live counts (Major elective, Gen ed · U.S. Society, Free elective, All courses), a quiet Ask AI, and "+N filters" when more are applied. Focus, typing, or a chip grows it into the course table (Course, Credits, Counts for, Eligibility, Fit, Add/Drop) with applied-filter chips and Clear all above it; Escape, Done, or a click outside folds it back with the query and scope still showing. Scope is requirement-first because "what does this count for" is the student's question; Subject and Level moved under More filters.
- Adopted from Rail: **live preview in the week**. Hovering or focusing a result ghosts its block into the week (dashed, 60%, in its kind colour), rings what it would collide with in amber, and shows "Previewing CIS 3203 · 18 → 22 credits" (warning tone past 18; "18 + 1–6 credits" for variable credits) in the week toolbar. Hovering a course already in the plan highlights its block and card instead. Add turns the ghost into the real block in place.
- Layout rule that follows from the preview: while the finder is open, the week must stay in view. The results list is capped (about five rows at 1440×1000, with its own scroll and a sticky header) and opening the finder scrolls the page just far enough for the week to show through 1 PM. Cost accepted: fewer rows visible than Bar alone showed.
- Shell: the left sidebar became a top bar (brand, term with Change term, the two steps, demo note, student) so the week and finder use the full width.
- Your courses stays the Cards decided above, beside the week; the ghost was added to the real week rather than shipping Rail's lighter list.
- Rejected: **Current** kept Banner's shape (criteria box, table, week below) and hid the applied scope. **Rail** (finder in a 400px rail beside the week) showed only four or five results at a time and gave the rail two jobs. **Slots** (enter from an open requirement, cards scoped to it) was the tallest and its copy the longest; good for the gen ed slot, heavy for browsing. **Palette** (⌘K overlay with a mini week in the detail pane) is a modal, which this project avoids, and the mini week was too small to judge a collision.
- Left behind from Rail: the Drill-in course page inside the finder. Course details stay on the Your courses side (see Course details above); the finder's details row is enough to decide Add.
- Left behind from Slots: "Take instead of AMST 0862". Swapping lives on the card's Or chips.

## Finding courses is its own page (2 November 2026)

- Decided after /proto/layout. Four layouts tried to keep the finder and the full week on one screen: **Current** (document scroll), **Fit** (the week compresses vertically to fit), **Float** (results float over the week), **Side** (the week compresses sideways and results take the Your courses column). Each paid somewhere: rows, hours, or the week itself. On a laptop (1440×770) only Side kept everything in view, and it did so by hiding Your courses and truncating days. Rafiat: "we are focusing on a wrong design problem."
- The finder moves to a **Find page** of its own, with a **mini week**: colour-coded blocks, no text, always fits. Hovering a result ghosts into it; shortlisted courses show as dotted blocks in it.
- The only verb on the Find page is **Shortlist**, capped at 10. Add and Drop stay on the plan page. One verb per page keeps the two from blurring back together.
- The plan page stays the landing page: the week is the hero and the demo opens mostly filled. The Find page is reached from an open slot on the plan ("3 electives to choose"), which scopes it, and from the top bar for free browsing. Steps become Find · Plan · Review.
- ~~Shortlisted courses return to the plan as options on the open slot's card (Or chips).~~ Tried in /proto/find/plan and rejected the same day: a major elective can replace any elective slot, so the same chips repeated on every card, and free electives landed everywhere.
- **Amended 2 November:** shortlisted courses return to the plan as **suggested courses**, the same as the planner's own suggestions: a card each in Your courses ("You shortlisted this" as the reason line) and a dashed block in the week, counted in credits and conflicts until dropped. Each card has Add / Drop as before; there is no separate remove-from-shortlist. **Confirm plan removes everything that was dropped.** Ten shortlisted courses make a crowded week and an over-18 warning on arrival; that is the point, the student drops down to a plan. Chosen over "undecided until added" (lighter cards, not counted, Add moves them in) to avoid a fourth card state.
- Find page layout: the Bar finder at full height on the left; a sticky right column with the mini week, the shortlist with credits tallied, and one primary, "Back to plan with N shortlisted". Course details open in that column as the Drill-in from Rail.
- Still to test: the return trip. How shortlisted courses appear on the plan and how a student drops one.

## Find result row — selected from /proto/finder-rows (3 November 2026)

- Chosen: **Tidy**, with Eligibility as chips. The table stays, but the title leads at 15px and the code sits small above it. Every cell sits on the title's first line. Credits read as a number or a range ("1–6"). Shortlist rests as quiet text and gets its ring on row hover or focus.
- Eligibility shows only exceptions, as chips:
  - "Needs CIS 3207", one chip per AND-group from the prerequisite tree
  - "In your plan", with a green check
  - "Completed", dimmed
  - restrictions as an outline chip
  - Met prerequisites leave the cell empty. The column hides when no visible row has anything to say.
- Colour in rows is neutral except conflicts (amber text) and the in-plan check. No red.
- Cost accepted: chips don't wrap, so long "X or Y" chips widen the column. Rows average about 76px in Major elective, against the old table's 75.
- Rejected:
  - **Line**, a two-line list with no columns. It was the densest at about 8.4 rows per screen, but had no column scanning and Shortlist read as plain text on touch.
  - **Entry**, a bulletin-style serif title with a description excerpt and tags. It fit about 4.3 rows per screen.
  - **Current**: the code outweighed the title, four status colours competed, and the chevron and a pill sat on every row.
- Audit: `finder-row-audit.md`.
