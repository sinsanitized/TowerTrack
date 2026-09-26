# Lindiana Workbook Import — Phase 1 Review and Plan

Date: August 6, 2026  
Source: `Excel Sheet for ANTHONY July 2026 (Legionella Sampling)xlsx.xlsx`  
Scope: read-only workbook, schema, database, and importer review. No import was performed.

## Executive decision

Do **not** run TowerTrack's current legacy importer against this workbook. The workbook is usable as source evidence, but not as a direct production import. It mixes customer/tower identity, responsibility, sampling history, planning notes, work-order numbers, and color-coded instructions in the same grid. Several meanings require Lindiana's confirmation.

The safe approach is a staged, reviewable import that:

1. preserves every original cell and its location;
2. distinguishes a proposed change from an approved change;
3. matches existing records without overwriting history;
4. routes ambiguity to manual review;
5. produces a deterministic dry-run report;
6. requires a verified backup and explicit approval before applying anything.

The current database already contains a July 24 import of an earlier workbook. This new workbook is therefore primarily an **update and reconciliation**, not a first import.

## 1. Workbook structure

- One visible worksheet: `Sheet1`.
- Used range: `A1:CD146`.
- Two header rows and 144 data rows (`3–146`).
- Columns `A:I` contain tower/customer attributes and the 2020 responsibility indicator.
- Columns `J:CD` contain month-by-month information for 2021 through 2026.
- Year headings are merged across month columns.
- The 2026 section contains January–July, a separate `SHH` column, then August–December.
- Auto-filter is enabled over row 2. There are no frozen panes.
- No formulas, formula errors, comments, notes, hidden rows, hidden columns, or sheet protection were found.
- Row 1 contains the legend `Grey Color=No Mandates`.
- `Augost` in the 2021 header is a spelling error.

### Operational assessment

The spreadsheet functions as a visual operations board, not a normalized data source. Its wide layout and undocumented colors are understandable to its author but unsafe for automated interpretation. History, future plans, status, and identifiers sometimes share the same kind of cell.

## 2. Source-field inventory and proposed mappings

| Source                | Observed meaning                                      | Proposed TowerTrack destination                    | Import decision                                                          |
| --------------------- | ----------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| ITEM                  | Apparent tower/item identifier                        | New source identifier/provenance field             | Preserve; confirm definition and stability before using as key           |
| Job Number            | Service job/account identifier                        | External job identifier                            | Preserve; not globally unique per tower                                  |
| Job Name              | Customer, property, or site name                      | Customer/building candidate                        | Stage only; clarify hierarchy                                            |
| Address               | Street address                                        | Building address line 1                            | Stage; city, state, and ZIP are absent                                   |
| System Type           | Mostly `CTA`/`ESC`, with anomalies                    | System type/raw source field                       | Preserve raw; map only after definitions are confirmed                   |
| TON                   | Cooling-tower tonnage                                 | `CoolingTowerSystem.tonnage`                       | Validate and propose update                                              |
| Cleaning              | Blank in every row                                    | None yet                                           | Do not create cleaning records                                           |
| Seasonal/12 Months    | Operating period                                      | `operationPeriodType`                              | Normalize controlled spellings; review blanks/special value              |
| 2020                  | Responsibility indicator and possibly a historic date | Staged responsibility plus possible historic event | Apply the explicit three-state rule; do not infer dates without approval |
| 2021–2026 month cells | Dates, day numbers, statuses, work orders, and notes  | Cell-level staging; approved event records only    | Never bulk-convert all populated cells to events                         |
| SHH                   | Probable sampling-history/status information          | Candidate SHH event                                | Confirm meaning and permitted event mapping                              |
| Cell color/font       | Business annotations                                  | Source-format metadata                             | Preserve in staging; never use as sole production meaning                |

The workbook has no dependable columns for city, state, ZIP, jurisdiction, portal submission, laboratory result, inspection, cleaning/disinfection completion, certification, or regulatory reporting. Those values must not be invented.

## 3. Business shorthand and responsibility interpretation

### Required responsibility rule for column I

The requested staged interpretation is:

- numeric Excel cell: `OUR_COMPANY` — 83 rows;
- exact `NO`: `OTHER_PARTY` — 40 rows;
- blank or anything else: `NEEDS_REVIEW` — 21 rows.

One of the 21 review cells contains the text `8/21/2020`; it is not a numeric Excel cell and must remain review-required. Four numeric cells display dates in December 2021 despite appearing under the 2020 heading. These need confirmation before they can become historical events.

TowerTrack currently has `OUR_COMPANY`, `CUSTOMER`, `OTHER_VENDOR`, and `NOT_TRACKED`, but no generic `OTHER_PARTY`. The three-state source meaning should remain intact in staging. Lindiana must decide whether `OTHER_PARTY` means customer, another vendor, or simply not contracted before production mapping.

### Other shorthand requiring definitions

Observed text includes `PD`, `pd`, `canceled`, `void pd`, `HOLD`, `NEEDS`, `ON`, `OFF`, `MAY`, `*`, `**`, `Done by HOMEYER`, `lost`, multiple dates/days in one cell, DOH-order notes, and work-order-like numbers. None should be assigned compliance meaning until defined.

Monthly `NO` occurs 2,475 times. It must not be treated as the column-I responsibility flag and must not automatically deactivate a tower.

## 4. Data-quality findings

### Base data

- 144 source rows.
- `ITEM` is blank on 8 rows.
- System type is blank on 2 rows.
- Six system-type cells contain numbers identical to their tonnage, suggesting a possible shifted/copied value; retain them for review rather than correcting automatically.
- Cleaning is blank on all 144 rows.
- Operating schedule: 77 `Seasonal`, 59 `12 Months`, 4 lowercase `seasonal`, 1 lowercase `12 months`, 1 `Seasonal (Serviced 2X a Year)`, and 2 blanks.
- Tonnage is populated on all rows, ranging from 18 to 2,466. Business limits are needed before calling any value invalid.
- Eight rows use gray/dark identity-cell formatting. The legend suggests “No Mandates,” but the exact jurisdiction and compliance effect is undocumented.

### Historical grid

- 4,744 populated monthly/history cells.
- 2,135 numeric cells:
  - 1,983 are integers from 1 through 31 and may represent days of a month;
  - 90 values over 31 are date-formatted;
  - 62 values over 31 are not date-formatted and commonly resemble work-order/reference numbers.
- Only 90 historical cells carry an explicit Excel date format. Day-only numbers need their month/year from the column but still require an event-type definition.
- Text entries use inconsistent capitalization and punctuation and sometimes combine several events or notes in one cell.
- Colors are used extensively, including gray, yellow, red text, and special 2026 highlighting, without a complete legend.

### Consequence

A parser may safely preserve and classify these cells, but it cannot safely convert all of them into compliance events. Each inferred value must retain the original raw value, displayed value, year/month, number format, fill/font, and cell address.

## 5. Duplicate and identity analysis

There are 11 duplicated Job Number groups, generally representing multiple towers at one site. Therefore Job Number cannot be a unique tower key. Duplicate groups include Alphamore, Bard Hall, Brooklyn Navy Yard, Castle Village, King Towers, LaGuardia Community College, Malcolm Shabazz, Manhattan Plaza, Montclair Art Museum, River Place, and Windsor Court.

Two pairs remain indistinguishable using job number, name, address, system type, tonnage, and operating schedule:

- Bard Hall, source rows 21 and 22;
- Montclair Art Museum, source rows 93 and 94.

Only `ITEM` distinguishes each pair. Its business definition and stability therefore need confirmation.

Names and addresses also repeat legitimately across multiple systems. Fuzzy name matching must never authorize an update by itself.

## 6. Comparison with current TowerTrack data

### Current production-shaped data inspected read-only

- 147 customers, 147 buildings, 146 cooling-tower systems, and 2,159 service events.
- One confirmed legacy-import batch from `Cooling Tower 07-24-2026 .xlsx`.
- That batch recorded 144 rows, created 142 systems and 2,147 events, skipped 2 review rows, and reported 0 existing-record matches.
- Four additional workflow-test systems are not represented in Lindiana's workbook and must not be deleted by synchronization.
- All current systems are configured as `NYC_AND_NYS`; all imported buildings use New York, NY with blank ZIP codes. The workbook does not provide enough geography to justify those assignments.
- Responsibility is populated for only two systems and null for 144.

### Read-only match result

- 140 of 144 new workbook rows can be matched confidently to the prior import/current data using exact deterministic evidence.
- Four matches are ambiguous: the two Bard Hall and two Montclair Art Museum rows.
- No source row is wholly unmatched.
- Two prior rows that were skipped are still review/new-record candidates: 525 East 80th Street and Brooklyn Public Library.
- One material operating-period conflict exists: Polmost is `12 Months` in this workbook but seasonal in TowerTrack.
- 137 confidently matched systems have a proposed responsibility value that differs from the null/current value. These must be shown as proposed field-level changes, not silently overwritten.

### Event reconciliation

Two cells could represent events not present in the prior import, but neither is safe to apply automatically:

- job `002286`: an SHH entry dated July 23, 2026;
- job `002800`: a July 27, 2026 date located in the August column.

Eight active sample/SHH events currently in TowerTrack are absent from the new workbook. They must be preserved and reported as system-only history. Absence from a spreadsheet is not deletion authority.

## 7. Current importer assessment

The existing legacy importer is not suitable for this update because it:

1. starts reading at the fourth Excel row and skips source row 3;
2. reads only the first worksheet;
3. creates a customer, building, and system for each accepted row rather than performing controlled matching/upserts;
4. does not resolve possible matches;
5. replaces the source Job Number with a generated identifier and stores the original only in notes;
6. applies one supplied jurisdiction/city/state/ZIP to the whole workbook;
7. does not parse or apply Legionella responsibility;
8. warns that repeated monthly `NO` may mean inactive;
9. treats confident dates/days as routine samples without enough semantic evidence;
10. cannot model portal submissions, laboratory results, resamples, or most shorthand;
11. commits rows independently and can leave a partially applied batch;
12. uses workbook hash for idempotency but lacks field-level precedence, approval, and override records.

A test parse of this workbook yielded 143 rather than 144 rows, 2,161 recognized events, and 2,638 ambiguous cells. That result is evidence for redesign, not an approved import result.

## 8. Recommended schema additions

Keep current operational tables and add/extend an import staging layer:

- Import batch: file hash, parser/rule version, worksheet set, source filename, uploader, status, dry-run report hash, approval, backup ID, and timestamps.
- Source row: batch, sheet, Excel row, raw identity values, stable source-row fingerprint, and current disposition.
- Source cell: address, raw value, displayed value, formula/type, number format, fill/font, year/month context, and parser classification.
- Match candidate/resolution: candidate entity, match rule, evidence, confidence, resolver, and resolution reason.
- Proposed field change: target entity/field, current value, proposed value, source evidence, precedence result, and approval status.
- Proposed event: type, date-only value, tower, raw source evidence, confidence, and duplicate evidence.
- Override: scoped resolution with reason, actor, timestamp, and optional expiry/version.

Add explicit external identifiers for `ITEM` and Job Number once their meanings are confirmed. Do not make Job Number uniquely identify a tower. Consider adding `OTHER_PARTY` to the operational responsibility enum only if the business needs to retain that exact unresolved external-party meaning; otherwise require a reviewed mapping.

Every applied write must use server-side authorization and create an audit record containing old value, new value, source batch/row/cell, and approval evidence.

## 9. Deterministic matching strategy

Use only confirmed identifiers and exact normalized evidence:

1. existing source lineage from the earlier import plus confirmed `ITEM` identity;
2. confirmed external tower identifier;
3. Job Number + normalized address + confirmed tower discriminator;
4. exact address/site plus system discriminator and corroborating fields;
5. otherwise manual review.

Normalization may standardize whitespace, case, punctuation, and approved street abbreviations for comparison, while preserving original values. Fuzzy name/address results may be displayed as suggestions but cannot apply updates. If multiple candidates receive the same strongest evidence, the row is review-required.

## 10. Precedence and update rules

- Existing verified/audited TowerTrack data wins over ambiguous spreadsheet content.
- An approved spreadsheet value may fill a missing field.
- A conflicting value becomes a proposed change and requires review; it never overwrites automatically.
- More recent approved evidence does not erase historical evidence.
- Planned activity never resets a compliance clock.
- Date-only values remain date-only and are never converted through browser/local time.
- Missing spreadsheet rows/cells never delete existing entities or events.
- Responsibility follows the explicit three-state source rule, with `NEEDS_REVIEW` blocking application.
- Jurisdiction is never inferred from a global NYC default. It requires verified location/rule evidence.
- Historical events are imported only when tower, event type, and date are sufficiently established. Otherwise retain the source cell in staging.

## 11. Staging, manual review, and overrides

The review queue should group issues by operational decision:

- match this source row to a tower;
- create a new tower;
- resolve responsibility (`customer`, `other vendor`, or `not tracked`);
- confirm operating period;
- classify shorthand/event type;
- confirm a date/month mismatch;
- establish geography/jurisdiction;
- accept or reject a proposed field update.

Each review item must show source row/cell, raw and displayed value, neighboring context, current TowerTrack value, proposed result, why it was flagged, and downstream compliance impact. An override must be explicit, reversible before apply, attributable, and reusable only when its scope is exact. Global “accept all” overrides should not be allowed for identity, jurisdiction, responsibility, or event type.

## 12. Implementation plan

### Phase A — definitions and fixtures

1. Obtain answers to the clarification questions below.
2. Freeze a redacted/test copy and expected row-level fixtures.
3. Define versioned normalization, responsibility, shorthand, and matching rules.

### Phase B — read-only staging parser

1. Parse all worksheets and preserve every source cell/format.
2. Generate stable row fingerprints and normalized candidates.
3. Validate base fields without inventing missing geography or jurisdiction.
4. Produce machine-readable and human-readable dry-run reports.

### Phase C — reconciliation and review

1. Match against source lineage and current records.
2. Generate proposed creates, updates, events, conflicts, and preserved system-only records.
3. Add an authorized review/override workflow.
4. Re-run until there are no unresolved blocking items.

### Phase D — controlled apply

1. Verify backup and approved dry-run hash.
2. Apply all approved changes in one transaction, or in resumable units with compensating records and a deliberately tested rollback model.
3. Create field-level audit records.
4. Recalculate obligations using authoritative rules only after committed verified events.
5. Generate a post-apply reconciliation report.

## 13. Proposed commands (design only; not implemented)

```text
npm run import:lindiana -- inspect --file "...xlsx" --output reports/import/<batch-id>
npm run import:lindiana -- dry-run --file "...xlsx" --overrides <review.json> --output reports/import/<batch-id>
npm run import:lindiana -- apply --file "...xlsx" --approved-report <report.json> --backup-id <verified-backup> --confirm-production
npm run import:lindiana -- verify --batch <batch-id>
```

`apply` must refuse to run if the file hash, parser/rule version, approved report hash, database baseline, backup verification, authorization, or blocking-review count differs from the approved dry run.

## 14. Backup and rollback plan

Before any production apply:

1. create a timestamped PostgreSQL logical backup and record its checksum;
2. verify it can be restored into an isolated database;
3. record the production schema migration/version and row counts;
4. retain the source workbook, dry-run report, overrides, and approval hash together;
5. prevent unrelated writes during the short apply window or detect baseline drift.

Normal rollback should use the import batch's field-level audit/provenance to reverse only values created or changed by that batch, without deleting pre-existing history. A full database restore is the catastrophic fallback and should be used only with an outage/data-loss decision because it also discards valid writes made after the backup.

## 15. Required tests

- Workbook coverage: all 144 rows and all cells through `CD146` are captured.
- Column-I responsibility: numeric, exact `NO`, blank, text date, and unexpected text.
- Date safety: Excel serials, day-only values, 1900-date-system behavior, month mismatch, leap day, and date-only round trips.
- Shorthand: every observed distinct string becomes a known classification or review item.
- Matching: unique match, duplicate Job Number, ambiguous same-site systems, missing ITEM, and no match.
- Precedence: fill missing, preserve verified value, conflict proposal, and no spreadsheet-driven deletion.
- Jurisdiction: no NYC default and no rule assignment without verified evidence.
- Idempotency: identical approved input produces no duplicate entities/events or second changes.
- Authorization/audit: unauthorized apply fails; every write records source and old/new values.
- Transaction/recovery: injected failure leaves no silent partial state.
- Reconciliation: source totals, proposed/applied/skipped counts, events, and preserved system-only records agree.
- Compliance regression: planned work does not reset clocks; cleaning and sampling stay separate; obligation calculations use only verified events.

## 16. Final read-only dry-run findings

| Category                                                  | Result |
| --------------------------------------------------------- | -----: |
| Source rows                                               |    144 |
| Confident existing-row matches                            |    140 |
| Ambiguous matches                                         |      4 |
| Wholly unmatched rows                                     |      0 |
| Previously skipped rows needing review                    |      2 |
| Existing non-source workflow-test systems to preserve     |      4 |
| Staged responsibility: our company                        |     83 |
| Staged responsibility: other party                        |     40 |
| Staged responsibility: needs review                       |     21 |
| Confident matches with responsibility differences         |    137 |
| Material operating-period conflicts                       |      1 |
| Possible new event cells requiring clarification          |      2 |
| Existing active events absent from workbook and preserved |      8 |

This is a reconciliation result, not an import authorization. No row is approved for production mutation by this report.

## 17. Clarification questions for Lindiana

### Blocking identity and hierarchy

1. What exactly does `ITEM` identify, who assigns it, and can it ever change or be reused?
2. Does Job Number identify a customer account, service location, contract, or something else?
3. In Job Name, which values are customers versus properties/sites? How should parent customer → building → tower be represented?
4. How should the two Bard Hall rows and two Montclair Art Museum rows be distinguished operationally?

### Blocking responsibility and jurisdiction

5. Does column-I `NO` mean customer responsibility, another vendor, not under contract, or simply not Lindiana's responsibility?
6. Does a numeric column-I value mean both “our company is responsible” and “this was the 2020 sample date,” or only responsibility?
7. What does gray `No Mandates` mean: non-NYC, non-NYS, no sampling mandate, inactive, or another rule profile?
8. Can Lindiana provide city/state/ZIP or a verified jurisdiction source for each site? The workbook alone cannot support NYC/NYS assignment.

### Blocking historical event import

9. What do `PD`, `HOLD`, `NEEDS`, `ON`, `OFF`, `MAY`, `canceled`, `lost`, `*`, and `**` mean?
10. What exactly is `SHH`, and does an SHH date represent collection, lab result, report, or another action?
11. Do month-cell numbers 1–31 always mean a Legionella collection date? Can they instead represent result, visit, invoice, or submission dates?
12. What are five- or six-digit numbers such as `90684-85`: work orders, invoice numbers, or something else?
13. How should multiple dates in one cell and DOH-order annotations be split into event records?
14. Should a date placed in the wrong month column be corrected, or preserved as an unresolved source conflict?

### Update policy

15. Is Polmost intended to change from seasonal to year-round, and from what effective date?
16. Are the two previously skipped sites active towers that should now be created?
17. Should the four workflow-test records remain, be marked test/inactive, or be removed through a separate approved cleanup?
18. Which system is authoritative when an existing verified TowerTrack event is absent from this spreadsheet?

Until the blocking questions are answered, the appropriate next step is to build only the read-only staging/dry-run path—not a production apply path.
