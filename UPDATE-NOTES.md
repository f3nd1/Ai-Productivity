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
