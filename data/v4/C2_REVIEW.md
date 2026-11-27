# C2 human review (gen/c2_edits.mjs, prefix c2-)

I read the rows myself: request, answer (patch ops) and the program context. Rule: if any kind had more than 1 wrong or unnatural row in 10, fix the generator and regenerate. Kinds read: add_option, remove_one, rename_button (buttons, titles, section and tab labels), rename_field, reorder, sections, setting_value (numbers, ranges, quick values, reminder times), no_change. 10 rows per kind per round (80 rows), seeds rv1 to rv7.

## What the rounds found, and the fix

| Round | Wrong or unnatural found | Fix in the generator |
|---|---|---|
| 1 (80 rows) | "for the kind choices" twice over; Down added to a Left/Right team pick; "More choices: X" when the program has two picks; unquoted labels read badly ("the updated number", "the this month card"); reorder "no change" rows counted as reorder; "the 2 quick button 4"; "my play to down to 80"; a target changed while its caption still said 5; a list removal that deleted 32 lines | F slot is the plain field name only; people/team/side fields and direction/compass families dropped; slot-less wording only when the program has one pick; unquoted label phrases only for 1 to 2 word button labels; no_change class set centrally; quick wording rewritten; setting phrase quoted when the label ends in a preposition; target edits skipped when the number occurs elsewhere or in the caption; removal of more than 14 lines or 45% of the program skipped |
| 2 (80 rows) | typos injected into slot values ("Clsases", "weeight", "banuqet"); "?." double punctuation; "a Enterprise", "a Entries"; "Twice a day" as a billing cycle; stars range widened to 25; "Today" as the title of a weekly-stat section; labels with ":" or "," | typos only in template words; no extra full stop after ? ! .; "a {T}" wording changed to "the {T}"; family tie-break by the smaller family and bad additions removed; ranges up to 10 skipped; labels with punctuation skipped |
| 3 (80 rows) | "teh the"; "the list of gs" (one-letter table); "My the numbers", "My plan b" | typo template fixed; table names under 3 letters not used as nouns; "My ..." prefix only for plain 1 to 2 word titles |
| 4 (80 rows) | add_option: 2 of 10 wrong (filter state `f`, "B plus" on an A/B pick); "Remove the title" (clashes with the app title); "i'd call what thing"; "Graph" as a section title; hours range widened x10 | single-letter picks and states without a label skipped; generic field names always quoted; two bad templates dropped; range multipliers x1.5, x2, x0.5 (x5 only from 1000) |
| 5 (80 rows) | "i need every to go as high as 60"; "put my slices in the pizza at 10"; "a Entries title"; bare "the what column" | generic or short field names skipped for ranges; three weak setting templates dropped; field names that are common words quoted |
| 6 (80 rows) | stat labelled "total for" and "of" (labels ending in a function word); "no more the dish column"; target edit on a number below 10 ("aim at 2") | labels ending in a function word or under 3 letters skipped; template reworded; targets under 10 skipped |
| 7 (80 rows, final) | none wrong, none unnatural | none |

Round 7 detail: add_option 0 of 10, remove_one 0, rename_button 0, rename_field 0, reorder 0, sections 0, setting_value 0, no_change 0. Rows from rounds 1 to 6 were regenerated, not patched, so the final file has no row from an earlier version.

Judgement notes (read as acceptable, not counted as wrong): app titles that get " log" or " tracker" added are plain but fine; "change the form to New sale" renames the form's button; some section titles (History for a schedule list) fit loosely; text of a no_change title request repeats the current title exactly.


## Revision 2 (after the critic's verdict)

Seven new kinds of change and a wider wording set meant a new read. I read all 170 `none` rows (twice: before and after the last generator change), plus 10 rows per kind in rounds rv8, rv9, rv10 and rv11 (13 kinds, 130 rows per round), and checked 15 two-label `none` reorder rows against the programs by script (all adjacent).

| Round | Found | Fix |
|---|---|---|
| rv8 | "my new the fixed charge", "New my price per unit" (article doubled before a setting name); "hte the train", "the the risk" (template plus "the" in the slot); "a issued field", "a outof field"; "at the end" for a stat inside a row; "oldest first first"; add-field Q "to reading" unclear | templates without "my/the/new {S}"; typo template dropped; a/an helper; position clauses inside a row say "at the end of the row"; no "first" clause; table named in full ("to the reading table") |
| rv9 | field called `next` ("before the next field"); "hrses"; Drained added to a priority pick (wrong family); Weekend added to a morning/afternoon/evening pick | generic field names quoted in position clauses; plural only for table names of 4 letters or more; low/normal/high picks always use the priority family; family tie goes to the first family in the file |
| rv10 | Weekend before Morning (family tie) | tie rule above |
| rv11 (final) | 0 wrong, 0 unnatural in 130 rows | none |

Rows were regenerated after every fix. The final file has no row from an earlier round.

Judgement notes: a reason closer such as "it keeps confusing me" after an add request is avoided (add kinds only take neutral closers); a few section titles fit loosely; "a what field" reads oddly for a field named what.
