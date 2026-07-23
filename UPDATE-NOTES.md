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


## July 2026 follow-up update

- Replaced the browser-dependent Department datalist with a proper select control.
- Added an Other department option that reveals a manual text field.
- Added an Overview department filter. Summary cards, the financial chart and the detailed table now follow the selected department.
- Added CSV export for the currently displayed detailed-view rows.
