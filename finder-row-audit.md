# Find: course row audit

3 November 2026. Scope: one result row in the course finder table on `/find`. That covers the code and title, credits, counts for, eligibility, fit and Shortlist. This follows `search-audit.md` (1 November), which settled what the finder is. This audit is only about how a row reads.

## What the row must do

- Let a student scan 37 to 461 rows and stop on the right one. The title does the scanning; the code confirms it.
- Say whether this course can go in the plan at all: whether it counts for something, whether prerequisites are met, and whether it fits the week.
- Offer one verb, Shortlist, without that verb becoming the loudest thing on the row.
- Stay quiet about the common case. Most rows have prerequisites met, and with placeholder times 243 of 461 conflict, so exceptions are what should show.

## Review

| Before | After | Why |
|---|---|---|
| The code is 13px/600 above a title at 14px/500, so the code is the heaviest thing in the cell | Title is the strongest text in the row (larger and heavier); code is secondary, tabular, quieter | Hierarchy is subtraction. Students scan by name, not by number |
| Four coloured status texts per row: purple "Major elective" with a swatch, green "Prereqs met", amber "Conflicts with…", gray "Variable" | Neutral by default; colour only on exceptions (missing prerequisites, conflicts), and one hue at a time | Four hues at 500 weight compete with the title and with each other. A limited palette reads as decided |
| "Prereqs met" repeated on almost every row | Say nothing when prerequisites are met, or use a quiet check; spell out only what's missing ("Needs CIS 2168") | The common case is noise; the exception is the information |
| The chevron sits in its own grid column at the far right of the course cell, ~200px from the title | Attach the drill-in cue to the title (hover underline or an inline arrow), or drop it and let the whole row show hover | It floats in empty space and reads as detached. Earlier review kept it only as the drill-in signal |
| Meta cells are pushed down 13px to line up with the code line, but the 32px Shortlist pill is centred on its own | Every cell aligns to one baseline: the first text line, with the button's label on it | Baselines currently step: code at y≈57, button centre at y≈69 in the screenshot |
| "Variable" in a right-aligned numeric Credits column | A numeric range ("1–6") or a dash with a tooltip, tabular, the same width as the digits | A word in a number column breaks the column's edge |
| Fixed 150px and 200px meta columns, so at 1440 the row is islands of text with large gaps | Size columns to their content, or fold meta into one line under the title | Wide gaps break the eye's path along the row |
| Every row carries a ringed pill button, 37 to 461 identical pills in a column | A quieter resting state (ghost or text), full button on row hover or focus. Shortlisted rows keep their state visible | Repetition turns the verb into a texture; the column of pills outweighs the course names |
| Table text is 13px, the title 14px | 14px UI text, title at 15–16px | Matches the product's UI role (14px rows) and gives the title room to lead |

## What others do

Linear and GitHub issue lists and Notion database rows all do the same three things: a strong title, metadata as one quiet line or as small neutral properties, and colour reserved for state. Course tools such as Coursicle and Stellic list the title first and push requirement status into small tags. This round did no outside research, so treat this as pattern knowledge, not evidence.

## Direction (proposed variants)

1. **Current**: what's there now, as the baseline.
2. **Tidy**: keeps the table and its columns. Fixes the hierarchy, baselines, colour discipline and the credits column; Shortlist is quiet until hover. Axis: refine within the table.
3. **Line**: no columns. Two lines per row: the title with the code beside it, then one meta sentence ("4 credits · Major elective · Fits Mon Wed Fri 12:00"), with only exceptions coloured. Shortlist sits at the right. Axis: a list instead of a table.
4. **Entry**: reads like a bulletin entry. The title is in Source Serif at 17px, which repeats the plan cards' signature. A one-line description excerpt sits under it, and status shows as two small neutral tags. Fewer rows per screen, more context per row. Axis: richer rows.

## Open questions

- Should Eligibility say anything when prerequisites are met?
- Should the table's column headers survive in Line and Entry? They lose sorting by column, and nothing sorts today.

## Sources

`~/.claude/skills/emil-design-foundations/SKILL.md`, `~/.claude/skills/emil-typography/SKILL.md`, `~/.claude/skills/emil-ui-polish/SKILL.md`, `search-audit.md`, `web/src/components/finder/finder.tsx` (row markup at line ~609) and `finder.css` (lines ~401–563).
