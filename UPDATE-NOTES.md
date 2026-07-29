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
