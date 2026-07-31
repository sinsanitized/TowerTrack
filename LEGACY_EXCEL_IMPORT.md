# Legacy Excel import

TowerTrack treats legacy workbooks as unverified source material, not as proof of historical compliance.

## Workflow

1. An administrator opens **Settings → Import legacy Excel workbook**.
2. The administrator supplies jurisdiction, rule-profile, and address defaults.
3. **Analyze workbook** reads the file and stores a preview batch. No customers, buildings, systems, or events are created during analysis.
4. The administrator reviews recognized dates, ambiguous cells, duplicates, warnings, and errors and selects eligible rows.
5. Confirmation creates each selected row in its own transaction. A failure in one row does not discard successful rows.
6. Imported sample and hyperhalogenation events are marked `LEGACY_EXCEL` / `UNVERIFIED` and excluded from compliance-clock calculations.

The default ZIP code is optional. If it is left blank, eligible rows can still be imported, but every affected building receives a clear warning and review item. TowerTrack stores no invented ZIP value; an administrator must complete the correct ZIP on the system edit screen.

Re-uploading the same workbook for the same organization loads the existing batch by SHA-256 file hash. The deterministic row identity is the file hash, worksheet name, and spreadsheet row number.

## Date mapping

- Column I (2020): complete dates only.
- J–U: January–December 2021.
- V–AG: January–December 2022.
- AH–AS: January–December 2023.
- AT–BE: January–December 2024.
- BF–BQ: January–December 2025.
- BR–BX and BZ–CD: January–December 2026.
- BY: 2026 summertime hyperhalogenation.

The 2021–2026 years are inferred from the repeated monthly blocks following the explicit 2020 column. This assumption is displayed in every preview.

Accepted values are Excel dates, complete date strings, and valid day-of-month values in a mapped month column. Status codes, ranges, notes, symbols, impossible dates, and work-order-like numbers are preserved for review and never converted to events.

## Rollback

Rollback deletes only customers, buildings, systems, events, and review items created by the selected batch. A row is protected from rollback if its system was edited after import or has non-imported events, activities, or requirements. Preexisting TowerTrack records are never deleted.
