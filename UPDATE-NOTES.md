# AI Impact Builder, 2026 UI and Department Update

## What changed

- Replaced the flat top navigation with a responsive workspace layout and desktop sidebar.
- Added a modern light visual system with softer cards, improved spacing, stronger hierarchy and clearer forms.
- Redesigned the Initiatives page with completeness bars, department labels and improved empty states.
- Redesigned the Overview page with department reporting, modern summary cards and clearer impact visualisation.
- Updated Section C, Section D, Settings, Export and Change Log styling for consistency.
- Added an optional Department field to each initiative.
- Added Department to the initiative list, initiative page, overview table and ERPNext export notes.

## Required Supabase migration

Run this once in the Supabase SQL editor before using the updated application:

```sql
alter table initiatives add column if not exists department text;
```

The same migration is also included at the end of `supabase-schema.sql`.

## Department behaviour

The field provides common UCC department suggestions but remains editable, so a custom department can also be entered.

## Verification completed

- `calc.test.mjs`, passed
- `evidence.test.mjs`, passed
- `export.test.mjs`, passed
- `overview.test.mjs`, passed
- `config.test.mjs`, passed
- JavaScript and JSX syntax check, passed

A full Vite production build was not completed because dependency installation timed out in the verification environment.


## August 2026, Initiative status

### Required Supabase migration (additive, safe)

```sql
alter table initiatives add column if not exists status text not null default 'Draft';
update initiatives set status = 'Draft' where status is null;
```

Nothing is deleted. Postgres fills every existing initiative with 'Draft' as it
adds the column, so no data is touched and nothing needs re-entering. The same
block is at the end of `supabase-schema.sql`.

### What changed

- Each initiative has a **Status**: Draft, In Progress or Done. It sits beside
  the initiative name in Initiative details and saves through the page's
  existing Save and blur autosave — no separate action.
- The Initiatives list shows it as a badge on each card: muted for Draft,
  indigo for In Progress, green for Done.
- A **Status filter** sits next to the department filter, defaulting to "All
  statuses". It stacks with search, department and sort, and "Clear filters"
  resets it too.

Until the migration is run the app still works — every initiative simply reads
as Draft, and changing the status will fail to save.

## August 2026, Section D out of the printed PDF

No migration — client only.

Print / Export PDF still printed the whole Section D — staff adoption, work
process impact and future readiness — inside each initiative's document. Since
Section D is one shared answer, every initiative's PDF carried the same three
narratives. It's now removed: the document runs cover, Section B (8-10),
Section C (11-13), then the four export fields, and stops.

Section D keeps its own page and is still part of the submission — it just
isn't per-initiative evidence, so it no longer appears in a per-initiative
record. The initiative page no longer receives Section D at all now, since
neither its export nor its print document uses it.

## August 2026, Elaborate uses the form's own guidance

No migration — prompt and wiring only.

- **Elaborate now knows which field it's working on.** It receives that
  question's "What to include" text from the form, so expanding B8 aims at the
  operational challenge, B9 at measurable cost, and B10 at the AI solution.
- **The form's example figures can't leak into your answer.** That guidance is
  full of illustrations like "Lost $5,000 monthly due to overstocking"; the
  prompt now explicitly forbids copying those figures, names or wording. If your
  note has no figure of that kind, none appears.
- **B10 draws on Section C.** Elaborating B10 gets this initiative's recorded
  results, so it can describe what the solution actually achieved instead of
  only rewording the sentence you typed. Quick Fill's B10 rule now also asks it
  to name the AI tool or type (ChatGPT, Gemini, Claude, a chatbot, predictive
  analytics, and so on) when your note mentions one — and not to guess when it
  doesn't.
- **Quick Fill suggests three initiative names, not one.** They're offered as
  clickable chips above the name box, deliberately different from each other
  (one naming the tool, one the process, one the outcome). Pick one or type your
  own. Duplicates, blanks and over-long titles are filtered out.

Tighten is unchanged and deliberately receives none of this — it only rewords
what's already there, so guidance could only tempt it to add something.

## August 2026, Export is per-initiative only

No migration — export logic only.

Action Taken was built from the global Section D, so every initiative's export
carried the same text. Section D is now out of the export entirely, and the four
fields map like this:

- **Finding** — B8 + B9, unchanged.
- **Root Cause & Resolution** — an analysis of why the problem happened and what
  should be done. It has no plain-text source, so it starts empty and
  "Generate with AI" writes it.
- **Action Taken** — this initiative's B10 solution, then each of its Section C
  qualitative notes tagged by type.
- **General Notes** — calculated result sentences, department, and the
  per-result detail blocks. The Section D figures (staff trained, total staff,
  training weeks, hours freed) are gone from here too.

Section D is also no longer sent to the AI as evidence for the export draft.
It still has its own page, and still prints as its own section in Print / Export
PDF, labelled as shared across the submission.

## August 2026, plainer and shorter AI output

No migration — prompt changes only.

Generated text was padded and kept writing "United Ceres College achieved a
remarkable reduction…" as though for an outside reader. This is an internal
tool, so every prompt now shares one house style:

- **1–3 sentences, around 100 words.** Applies to Generate C answers, Tighten,
  Elaborate, the Export draft and Quick Fill alike.
- **No organisation name, no third-person framing.** The reader knows which
  college it is.
- **No praise.** No "remarkable", "significant", "innovative", no sentences
  about commitment or transformation. Facts and figures, then stop.
- **No more `[add: ...]` markers.** Elaborate and Quick Fill now write less
  rather than naming what's missing. Text generated before this change still
  shows its markers highlighted so you can clear them.

Quick Fill also now works the initiative name out from the problem and solution
it extracts, so it matches the rest of the fields instead of being guessed
separately.

## August 2026, Quick Fill becomes propose-and-elaborate

No migration — this only changes how Quick Fill drafts into existing fields.

Quick Fill used to extract literally: anything not spelled out stayed blank, so
a rough note produced three near-empty B fields. It now drafts, under two
deliberately different rules.

- **Wording may be elaborated.** B8/B9/B10 and each proposed result's note come
  back as fuller prose. Where the form wants a specific detail your note didn't
  give, you get a bracketed `[add: ...]` marker naming what's missing, shown in
  the same highlighted panel Elaborate uses — not a blank box, and not an
  invented fact.
- **Figures may not.** A before/after value or monthly saving is filled only
  when your note actually contains a numeric hint. Vague hints count — "roughly
  halved", "about 20% faster", "a couple of thousand a month" — and the result
  is labelled "Estimated from your notes — confirm or adjust" in amber. Edit the
  value and the label clears, because it's then your figure. With no numeric
  hint at all the field stays blank, exactly as before.

Financial results can now carry a monthly saving when your note states one, so
they compute straight away instead of always needing the figure added by hand.
With no figure stated, they still arrive blank rather than guessed.

## August 2026, Quick Fill

No migration and no new columns — Quick Fill only populates existing fields.

- "Quick Fill" sits beside "Generate C answers" on the initiative page. Paste one
  rough note covering the problem, what you did and any numbers, and it comes
  back as B8/B9/B10 plus proposed Section C results.
- There is always a review step. Every extracted field and proposed result is
  editable, each result has an include/exclude tick and a delete, and nothing
  reaches the page until you click Apply.
- Anything the note doesn't clearly state is left blank and labelled as such,
  never guessed. Financial results deliberately arrive without saving figures —
  a rough note rarely states the basis clearly enough, and inventing a money
  number for an award submission is the one thing this must not do. Add the
  hours and rate, or a direct monthly figure, on the card afterwards.
- Applying fills the page in only. The existing Save button is still what
  persists it, and replacing B8/B9/B10 text you already wrote asks first.
- With live AI turned off or no key set, the review screen still opens empty so
  the fields can be filled in by hand.

## August 2026, Initiative IDs + Figures Table

### Required Supabase migration

Run the `initiative_code` block at the end of `supabase-schema.sql` as one
statement batch in the SQL editor. It adds the column, backfills existing
initiatives in creation order (oldest = INIT-01), creates the sequence that
generates future codes, and adds a unique index. Non-destructive, and safe to
re-run. Codes appear only after it has been run — until then the app shows a
dash in the ID slots.

### What changed

- Every initiative has a short read-only code (INIT-01, INIT-02, ...), shown on
  its list card, in its page header, and as the first column of the Figures
  Table. It's generated by a Postgres sequence used as the column default, so
  it stays unique and sequential even if two initiatives are created at once.
- New "Figures Table" tab between Overview and Overall / Section D: one row per
  Section C result across all initiatives, with grouped Productivity /
  Financial / Operational columns and dashes where a group doesn't apply to that
  row's type. Sortable on every column, filterable by initiative and type, with
  CSV download. Every figure comes from the existing calc.js calculators, so it
  can't drift from what an initiative's own page shows.

## August 2026, Print / Export PDF

No migration and no new endpoint — this is client-only.

- "Print / Export PDF" in the initiative page's top bar opens the browser print
  dialog, where "Save as PDF" produces the document. No PDF library was added.
- The output is a purpose-built document, not a screenshot of the form: cover
  block, Section B (8-10), Section C (11-13) with each generated answer followed
  by a real table of the results behind it, Section D (14-16) marked as shared,
  and the four ERPNext export fields. Not-applicable C sections print
  "Not applicable to this initiative" instead of an empty table.
- Serif body text, single column, A4 with 20/18/22mm margins, rules instead of
  boxes, and page-break-inside avoided per numbered section so a heading can't
  strand at a page end. No buttons, inputs, nav or "What to include" hints.
- The export fields print exactly what's on screen, including AI-generated and
  hand-edited text, rather than re-derived defaults.

Known limitation: browsers can't number pages from CSS via `window.print()`, so
the repeating footer carries "United Ceres College — Confidential" only. Enable
the print dialog's own headers/footers option if you want page numbers.

## July 2026, completeness fix + initiative management

### Required Supabase migration (additive, safe)

```sql
alter table initiatives add column if not exists not_applicable jsonb not null default '{}'::jsonb;
alter table initiatives add column if not exists updated_at timestamptz;
```

Nothing is deleted. Existing rows get the defaults; `updated_at` starts NULL and
fills in on each initiative's next save.

### Two data-integrity fixes

- **Completeness was measuring text, not evidence.** An initiative with zero
  Section C results could read 9/9 "submission ready": stored generated C text
  scored a point on its own, and the shared Section D handed its three points to
  every initiative regardless of whether that initiative contributed anything.
  Now C11/C12/C13 each require a linked result of that type (or an explicit
  "not applicable" tick), and the shared Section D only counts for initiatives
  that have some Section C evidence of their own. On the walkthrough data, the
  worst offender drops from 9/9 to 3/9.
- **Stale generated answers stayed visible and copyable.** A question with no
  evidence showed "Add a [Type] result first" while still displaying old
  generated text with a working Copy button. That text is now hidden (not
  deleted) until evidence exists again, with a note explaining where it went.

### Initiative management

- Initiatives list gained live name search, a department filter (including
  "Not set"), and sorting by name, completeness either way, or recently updated.
- Cards below 40% completeness are flagged "Needs evidence", and call out
  generated answers with no evidence behind them.
- "Add initiative" now asks for a name (required) and department (optional)
  before creating anything — no more silent "Untitled initiative" rows.
- "Duplicate" on each card copies B8/B9/B10 and department into a newly named
  initiative. Section C results are deliberately not copied.
- The initiative page flags an unset department next to the field and in the
  header.
- Overview's table sorts by any column; missing values always sort last so
  "Complete, ascending" surfaces the weakest initiatives first.

Still open for a future round: evidence attachments (file upload) and per-field
edit history.

## July 2026, Section D goes overall + AI expansion

### Required Supabase migration, THIS ONE DELETES DATA

Run once in the Supabase SQL editor, after copying out anything you want to keep:

```sql
delete from section_d;
drop index if exists section_d_initiative_id_key;
alter table section_d drop column if exists initiative_id;
```

This discards **every existing per-initiative D14/D15/D16 row** — all D14
narratives, staff-trained / total-staff / training-weeks figures, D15
narratives, hours-freed / staff-affected figures and D16 narratives, for every
initiative. Nothing is merged forward. This is deliberate: Section D is now one
overall answer set for the whole submission, and there is no correct automatic
way to combine several per-initiative answers into a single organisation-wide
one. Re-enter Section D once on its new page afterwards.

### What changed

- Section D moved off the per-initiative page to its own top-level
  "Overall / Section D" tab, positioned after Overview as the closing step. One
  set of D14/D15/D16, same fields and calculators, its own Save + blur autosave.
- Overview's summary now reports one organisation-wide adoption % and one
  hours-freed total; the per-initiative table drops its D14/D15 columns (and so
  does the CSV export), since those figures are no longer per initiative.
- Export block gained **Generate with AI**, writing Finding / Root Cause &
  Resolution / Action Taken / General Notes from the initiative's B and C
  evidence plus the overall Section D. The assembled plain-text version still
  shows until it is clicked, and every field stays editable after. The numeric
  fields (Man-Day Rate, Before/After Time, Cycle per Month) are unchanged.
- **Elaborate with AI** added next to every Tighten button (B8–B10, Section C
  notes, overall D14–D16). It expands a thin fragment into fuller prose and is
  forbidden from inventing anything: missing specifics come back as
  `[add: ...]` placeholders, which the UI lists in a highlighted panel under
  the field so it is obvious what still needs a real figure.
- Section C Unit is now a dropdown (%, hours, minutes, days, working days, $,
  count, errors, calls, records, Other) with an Other free-text fallback.
- Section C Metric name is now a searchable combobox: it suggests common
  metrics but accepts any free text.

## July 2026 follow-up update

- Replaced the browser-dependent Department datalist with a proper select control.
- Added an Other department option that reveals a manual text field.
- Added an Overview department filter. Summary cards, the financial chart and the detailed table now follow the selected department.
- Added CSV export for the currently displayed detailed-view rows.
