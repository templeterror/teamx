# Course search: audit and redesign direction

Written 1 November 2026 from the code in `web/src/components/plan/course-search.tsx`, the Temple Banner screenshots on Page 1 of the Course Planner Figma file, and outside research. Scope is the search surface only. How a chosen course lands in the week and in Your courses is a later pass.

## What to call it

It is not a search engine. It is a **course finder**: faceted browsing over a small, fully known catalog (461 courses, one placeholder section each), where the student already knows roughly what they need and wants to see what qualifies. In the UI, call it **Find courses**. In design conversation, "finder" or "faceted browse" is the honest name.

## What the surface has to do

From `productthink.md`:

- The dashboard opens on a plan that is about 75% made. Search exists to settle what is still open: three major electives and one gen ed for the demo student, and to answer "what else could I take?".
- Keep Banner's sequence (term, plans, search classes, check the week, register). Do not copy Banner's visual design.
- Decisions already recorded: section table with aligned columns; Search courses and Ask AI tabs above results on the planner page; week and Your courses below; course details use Drill-in inside Your courses; Add / Drop words; dotted means flexible; one red primary per screen.

Data available right now in `web/src/data`: code, title, credits, description, gen ed areas, attributes (WI, HO, SI…), prerequisites as an expression tree, restrictions, typically offered (only 85 of 461 courses). Sections are placeholders: one per course, made-up days, times, instructors, campus. No seats, no CRNs.

## What is there today

Screenshot evidence: the local app at `/plan` on a 1440 px viewport, and the five Banner screenshots in Figma (section `current temple official site design`).

**Banner (the contrast).** Eight criteria fields in a form, then a 13-column results table (Part of term, CRN, subject/course/section, campus, hours, title, meeting times, capacity, instructor, materials cost, attribute, fees, reserved seats, Add). The information students need, what a course counts for and whether they are eligible, is not in the table at all. The week and the plan summary sit below, in separate panels.

**Our current search.** Better than Banner, but it kept Banner's shape: a criteria box, then a results table, then the week. Findings, one row per issue:

| Before | After | Why |
| --- | --- | --- |
| Search card plus a 490 px results table is the first screen. The week starts around 540 px down at 1440×1000. | Search is a slim bar until the student acts; the week stays the hero. | `productthink.md`: the screen opens on a plan, not on an empty search. The judge's 20 seconds are the filled plan. |
| Subject = CIS and Level = 3000+ are applied on load as dropdown values. Header says "CIS sections 43" and hides the level filter. | Applied scope shown as removable chips above the results, with Clear. | Baymard: without an applied-filter overview users misjudge the catalog and conclude a course does not exist. 28% of sites fail this. |
| Primary filters are Subject (about 60 raw codes like AAAS, GUS) and Level (two options). | Primary filter is **Counts for**: Major elective, Gen ed (the one still open), Free elective, Anything. Subject, level, attribute, days become secondary. | The persona's question is "what counts?", not "which department?". Stellic's "Counts for" and "Only with cleared prerequisites" are the pattern universities have converged on. NN/g: filters only help when they match what users care about. |
| Rows are labelled sections, but the data has one placeholder section per course. Meeting time and instructor/campus take 41% of the width with made-up values. | Row = course. Columns carry what we know is true: code and title, credits, counts for, eligibility, then a short fit line. Section detail becomes a disclosure once real sections exist. | Do not let placeholder data be the loudest thing in the row. Fake times are also why most rows currently read "Time conflict". |
| Plan status is "Time conflict" or "Fits your week", relative to the week only. | Two signals: **Eligible / Needs CIS 2168** (from the prerequisite tree against the plan) and **Fits Tue 11:00 / Conflicts with Software Design**. | Name the conflict. Eligibility is the decision students cannot get from Banner. |
| Details expand inline in the first column: description only, squeezed into 37% width, no prerequisites, no counts-for, no "prerequisite for". | Clicking a row opens the same Drill-in course page already chosen for Your courses, with Add on the page. | One details pattern on the page. The Drill-in page already holds prerequisites, prerequisite-for, good to know, alternatives. This is also the bridge to the planner side later. |
| 490 px scroll container plus 8-row pagination with Previous / Next. | One mechanism. For 40-odd rows, a scroll region with a sticky header and a count; pagination only past about 50. | Two scrolling mechanisms for one list is a Banner habit. |
| Add is an icon-only + / − in the last column; confirmation is a status sentence 300 px below the row. | Text **Add** / **Drop** buttons as elsewhere; confirmation in the row (button state) and in the week. | Your courses and course details already use the words. Icon-only mixes two conventions on one page. |
| Adding changes the week silently, below the fold. No preview before Add. | Hover or focus a row ghosts its block in the week; the "Or" chips already peek this way. | Stellic and Coursicle both preview placement; the Lou's List and Albert research says tab-switching to check fit is the top pain. |
| Ask AI is a tab that swaps the form; the "CIS sections" table stays underneath in AI mode. | Ask AI stays a layout stub, visually subordinate, and does not leave the results table orphaned. | `productthink.md` lists natural-language search under "leave thin". |
| Course code set in accent red in a column that is a disclosure button. | Accent reserved for the one action and links; codes in ink, category color where the week legend already uses it. | Visual system: red is the button, the link, and the elective label. A red code reads as a link that is not one. |
| Table at phone width scrolls sideways with five columns. | Rows collapse to a two-line card below about 720 px. | Not for the judge, but the component should not break the moment the pane narrows. |

What is already right and should stay: `aria-expanded`, `aria-label` on Add, a `role=status` notice, native selects, 16 px inputs, 44 px targets, sticky header, tabular numbers, the empty state with Clear filters, and the honest "meeting times are samples" note.

## What others do

- **Banner (Temple today).** Form-first, 13-column table, Add per row. Nothing about requirements or eligibility. Students keep the bulletin open in another tab.
- **Stellic** (UVA, JHU, FSU, UWM, UNL). Search lives in a right sidebar beside the plan. Filters: semester, Counts for, instructor, department, attributes, campus, modality, credits, level; checkbox "Only with cleared prerequisites". Results drag into a term or open details with Add to Plan. Requirement placeholders are dotted; hovering a section previews it in the calendar. Students at UVA preferred it to Coursicle and Lou's List for its suggestions.
- **Coursicle.** One card per section; click reveals instructor, times, description; a color-coded mock schedule sits beside the list.
- **Berkeleytime and student-built schedulers.** Generate schedules, flag conflicts in a color key, hover names the conflict.
- **Enterprise and e-commerce research.** Baymard: always show applied filters as chips with × above the list, give Clear all, allow multiple values inside one filter type, and keep extra chip rows from pushing the list down. Algolia: show counts beside unselected facet options and update them live. NN/g: faceted navigation only pays off when users need several dimensions; keep filters matched to what users care about; users pinball between results and refinements. No-results pages must say nothing matched, suggest a fix, and offer related items.
- **Catalog vendors (Modern Campus).** Students expect typeahead, filter tags, prerequisites and requirements labelled clearly, and the path from search to plan without leaving the page.

## Direction

1. **Requirement-first scope.** Default chips: Major elective · Gen ed GB · Free elective · All. Each chip carries a live count. A second row of secondary filters (Subject, Level, Attribute, Days, Eligible only) stays collapsed behind "More filters".
2. **One search field** that matches code, title, and description, with typeahead for codes and titles. Local data, so no debounce needed; keep it inside a `<form>` so Enter works.
3. **Course rows** with: code and title; credits; counts-for category in the week's legend color; eligibility; one fit line that names the conflict. Sorting: relevance when there is a query, otherwise counts-for then code.
4. **Applied-filter chips** above the list, Clear all, and a count sentence ("12 courses count toward your gen ed").
5. **Details through Drill-in.** A row click opens the course page in the Your courses rail; the week stays beside it with the course ghosted. Add lives on the row and on the page.
6. **Live preview in the week** on hover and focus, using the same peek the Or chips use.
7. **Search collapsed by default** to a one-line bar: field, scope chips, count. It expands to the table on focus, query, or chip. This is the one change that touches a recorded decision (table above the week), so it is a call for you, not me.
8. **Ask AI** stays a quiet secondary control beside the field, not an equal tab.

## Open questions for you

- Keep the search above the week (as decided) but collapsed until intent, or move results into the right rail Stellic-style with the week always visible? I recommend collapsed-above: it keeps the decided table and columns, and keeps the week as the hero.
- Should the placeholder meeting times keep driving a "fits / conflicts" signal in the demo, or should fit be shown only once a section is real? Fake conflicts make the catalog look hostile.

## Next step

Build it the way Your courses and course details were decided: a `/proto/search` page with the current search plus two or three variants behind a picker, on the same mock data, then pick one and fold it into `/plan`. Before that, per `AGENTS.md`, you decide whether this goes in the Figma file first or straight into code.

## Sources

- Baymard, [How to design applied filters](https://baymard.com/blog/how-to-design-applied-filters)
- Baymard, [Ecommerce filter UI](https://baymard.com/learn/ecommerce-filter-ui)
- Nielsen Norman Group, [Filters vs. facets](https://www.nngroup.com/articles/filters-vs-facets/)
- Algolia, [Search filter UX best practices](https://www.algolia.com/blog/ux/search-filter-ux-best-practices/)
- Modern Campus, [Course catalog optimization: what students expect](https://moderncampus.com/blog/course-catalog-optimization-what-students-expect-in-2025.html)
- Stellic, [Adding courses to your plan](https://knowledge.stellic.com/en/articles/11438252-adding-courses-to-your-plan) and [Courses that fulfill a requirement](https://knowledge.stellic.com/en/articles/9048061-how-can-i-see-a-list-of-courses-that-will-fulfill-a-requirement)
- UNL Registrar, [Degree audit course search](https://registrar.unl.edu/stellic-advisor-resources/degree-audit-course-search)
- Cavalier Daily, [Students on Stellic at UVA](https://cavalierdaily.com/article/2025/03/students-express-contentment-with-new-stellic-advising-program)
- Forge, [Lou's List UX redesign](https://medium.com/joinforge/course-registration-made-simple-lous-list-ux-redesign-646bf15975d6)
- Coursicle on [Product Hunt](https://www.producthunt.com/products/coursicle/reviews)
- Kanopi, [How to design a better academic catalog](https://kanopi.com/blog/how-to-design-a-better-academic-catalog/)
