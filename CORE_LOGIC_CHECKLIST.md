This version preserves the original checklist while updating the Legionella clock, portal-reporting responsibility, workflow behavior, tests, and acceptance flow.

# TowerTrack core logic checklist status

Reviewed and tested July 13, 2026. Revised to clarify that NYC routine Legionella dates are calculated immediately from completed qualifying sample collection dates.

Portal reporting is tracked as a separate, non-blocking obligation. It may be assigned operationally to the company, customer, another third party, or administrative review. Missing, late, externally assigned, or unassigned portal reporting does not stop routine scheduling, laboratory workflow, corrective actions, route creation, visit completion, or future sampling.

Status terms are: **Implemented**, **Partially implemented**, **Stubbed**, **Not implemented**, **Blocked**, and **Needs clarification**.

The five MVP completion gates are working with tests: Legionella scheduling, date recalculation, manual route grouping, visit completion, and six-color/plain-English status logic.

The broader supporting-regulation, portal-responsibility, corrective, audit, and administration checklist is not fully complete. Gaps are identified below.

## Core NYC Legionella and portal rule

Routine Legionella sampling and portal reporting are separate obligations.

A completed NYC Legionella sample resets the routine sampling clock when:

1. The sample collection activity is completed.
2. The actual collection date is recorded.
3. The sample is explicitly marked as qualifying for the routine sampling requirement.
4. The sample is linked to the correct cooling-tower system and open routine obligation.

When those conditions are met:

- the routine sampling obligation closes;
- the next routine hard due date is calculated immediately;
- the next NYC routine due date equals the qualifying sample collection date plus 31 calendar days;
- portal reporting, laboratory results, and corrective follow-ups may remain open independently.

Portal submission is not required before the next routine sampling date is calculated.

The following dates do not replace the sample collection date as the routine sampling anchor:

- portal-submission date;
- portal-confirmation date;
- laboratory-receipt date;
- laboratory-result date;
- result-review date;
- result-upload date.

A qualifying NYC sample creates a separate portal-reporting obligation due five calendar days after collection.

Portal responsibility may be operationally assigned to:

- `COMPANY`
- `CUSTOMER`
- `THIRD_PARTY`
- `UNASSIGNED`
- `NOT_APPLICABLE`

This assignment is used for operational coordination only. It does not determine legal, contractual, statutory, or regulatory responsibility.

Open, late, customer-assigned, third-party-assigned, or unassigned portal reporting:

- does not change the next routine sampling due date;
- does not reopen a valid completed sampling obligation;
- does not block laboratory-result entry;
- does not block corrective-action generation;
- does not block route creation;
- does not block visit completion;
- does not block future routine sampling;
- does not stop any other operational workflow.

Changing, correcting, reassigning, completing, or voiding only the portal-reporting record does not change the routine sampling clock.

The routine clock changes only when the underlying qualifying sample is corrected, voided, canceled, or determined not to qualify.

## 1. MVP priority

| Criterion                                                             | Status                | Evidence / limitation                                                                                                                               |
| --------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legionella scheduling is the center of the app                        | Implemented           | Home and Planning lead with Legionella timing.                                                                                                      |
| NYC Chapter 8 is the most complete workflow                           | Implemented           | NYC has fixed 31-day scheduling, separate portal follow-up, completion recalculation, and seeded corrective work.                                   |
| NYS-only and out-of-state profiles exist without distracting from NYC | Implemented           | Versioned profiles are visible mainly as source and context.                                                                                        |
| Planning is the primary workflow, not the calendar                    | Implemented           | Planning is labeled `Primary workflow`; Schedule functions as an agenda.                                                                            |
| Scheduler can see what is due, where, and what to schedule next       | Implemented           | Planning rows show location, dates, remaining days, status, action, and explanation.                                                                |
| Completed qualifying sample immediately recalculates next routine due | Implemented           | Completion uses the actual collection date and active profile interval.                                                                             |
| Portal reporting remains a separate obligation                        | Implemented           | Completion creates a blue portal follow-up due five days after collection.                                                                          |
| Portal reporting does not block the operational workflow              | Implemented           | Routine sampling, laboratory, corrective, route, and future planning continue independently.                                                        |
| Portal responsibility can be assigned independently                   | Partially implemented | Portal follow-up exists, but confirm that company, customer, third-party, unassigned, and not-applicable responsibility states are fully supported. |

## 2. Rule profiles

| Criterion                                                | Status                | Evidence / limitation                                                                                           |
| -------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------- |
| Every system has an active `ruleProfileId`               | Partially implemented | `ruleProfileId` is required; assignment to an inactive profile is not yet blocked through an admin write path.  |
| NYC systems use the combined NYC/NYS profile             | Implemented           | Seed assignments and profile warnings cover NYC geography.                                                      |
| NYS systems outside NYC use NYS-only                     | Implemented           | Seed assignments and profile warnings cover this distinction.                                                   |
| Out-of-state defaults to Company Policy                  | Partially implemented | Seed and import structure supports it; no building or system creation wizard assigns the default automatically. |
| Pending profiles produce no hard deadlines               | Implemented           | Rule engine returns no hard due date and scheduling is disabled.                                                |
| NYC 31-day rule is not global                            | Implemented           | Interval selection is profile-scoped.                                                                           |
| NYS-only never receives NYC 31 days                      | Implemented           | NYS-only is fixed at 90 days even if configuration is incorrect.                                                |
| Out-of-state policy is labeled Company Policy            | Implemented           | Authority remains `COMPANY_POLICY`.                                                                             |
| Stricter company targets retain their source label       | Implemented           | Company target remains separate from regulatory hard due.                                                       |
| Portal responsibility is separate from the rule profile  | Needs clarification   | Confirm whether responsibility is assigned per customer, agreement, system, obligation, or portal event.        |
| Portal responsibility does not determine legal liability | Implemented as policy | Responsibility labels organize work only and do not establish legal responsibility.                             |

## 3. Legionella due dates

| Criterion                                                       | Status                       | Evidence / limitation                                                                                |
| --------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| NYC due equals last qualifying sample plus 31 calendar days     | Implemented                  | Fixed rule with unit and browser acceptance coverage.                                                |
| NYS-only due uses 90 calendar days                              | Implemented                  | Fixed rule with unit coverage.                                                                       |
| Out-of-state interval is configurable                           | Implemented                  | Profile interval is used for Company Policy profiles.                                                |
| Only a completed qualifying sample resets the clock             | Implemented                  | Shared eligibility function is used by queries and completion.                                       |
| Next due date uses sample collection date                       | Implemented                  | Completion uses the performed collection date as the anchor.                                         |
| Portal submission is not required for date recalculation        | Implemented                  | Portal follow-up is separate from routine-clock eligibility.                                         |
| Portal submission date does not reset or anchor the clock       | Implemented                  | `PORTAL_SUBMISSION` is not a qualifying sample type.                                                 |
| Portal responsibility does not affect date recalculation        | Implemented as business rule | Company, customer, third-party, or unassigned responsibility must not change the next sampling date. |
| Cleaning does not reset                                         | Implemented                  | Non-sample activity types are rejected even if incorrectly flagged.                                  |
| Disinfection does not reset                                     | Implemented                  | Same sample-type guard.                                                                              |
| Inspection does not reset                                       | Implemented                  | Same sample-type guard.                                                                              |
| Planned visit does not reset                                    | Implemented                  | Requires completed status and performed date.                                                        |
| Cancelled visit does not reset                                  | Implemented                  | Cancelled, missed, and voided visits cannot qualify.                                                 |
| Missed visit does not reset                                     | Implemented                  | Same status guard.                                                                                   |
| Laboratory result date does not reset                           | Implemented                  | `LAB_RESULT` is not a qualifying sample type.                                                        |
| Portal record correction does not change routine clock          | Needs explicit test          | Only the underlying sample should control the sampling anchor.                                       |
| Portal record void does not reopen routine sampling             | Needs explicit test          | The generic audited void workflow exists; add a portal-specific regression test.                     |
| Underlying sample void reopens or recalculates routine sampling | Implemented                  | The audited void workflow rebuilds projections from active events; correction/reversion is covered.  |
| Month-end arithmetic                                            | Implemented                  | UTC-safe date-only arithmetic with unit coverage.                                                    |
| Year-end arithmetic                                             | Implemented                  | Unit coverage.                                                                                       |
| Leap-year arithmetic                                            | Implemented                  | Unit coverage.                                                                                       |
| No timezone date shift                                          | Implemented                  | ISO date helpers use UTC-safe date-only handling and PostgreSQL `date`.                              |

## 4. Routine sampling versus portal reporting

### Routine sampling obligation

A routine sampling obligation is satisfied when:

1. The Legionella sample collection activity is completed.
2. The actual collection date is recorded.
3. The sample is explicitly marked as qualifying for the routine requirement.
4. The sample is associated with the correct cooling-tower system.
5. The sample is linked to the applicable open routine obligation.

When those conditions are satisfied:

- the routine sampling obligation closes;
- the next routine sampling due date is calculated immediately;
- NYC systems receive a next due date equal to collection date plus 31 calendar days;
- NYS-only and Company Policy systems use their active profile intervals;
- portal reporting may remain open;
- laboratory results may remain pending;
- corrective obligations may be generated later without reopening the completed routine sample.

### Portal-reporting obligation

A qualifying NYC sample creates a separate portal-reporting obligation:

- due date equals collection date plus five calendar days;
- the obligation remains separate from the routine sampling obligation;
- the submission date is retained for reporting history and timeliness;
- completing it does not recalculate the next routine sampling date;
- correcting it does not recalculate the next routine sampling date;
- reassigning it does not recalculate the next routine sampling date;
- voiding only the portal record does not reopen the routine sampling obligation.

### Portal operational responsibility

Each portal-reporting obligation must support one operational responsibility assignment:

- `COMPANY`
- `CUSTOMER`
- `THIRD_PARTY`
- `UNASSIGNED`
- `NOT_APPLICABLE`

Responsibility assignment indicates who is expected to perform or confirm the portal submission.

It does not establish who is legally responsible for compliance.

### Company-assigned portal responsibility

When portal reporting is assigned to the company:

- the item may enter the company actionable work queue;
- reminders and overdue escalation may be generated;
- an employee or assigned team may complete the submission;
- completion should record the submission date and confirmation reference when available.

### Customer-assigned portal responsibility

When portal reporting is assigned to the customer:

- the portal obligation is tracked as an external follow-up;
- it should not appear as required technician service work;
- TowerTrack may create a reminder to request or verify confirmation;
- missing customer confirmation does not block sampling, treatment, laboratory, corrective, route, or visit workflows;
- the UI must identify the obligation as customer responsibility.

### Third-party-assigned portal responsibility

When portal reporting is assigned to another third party:

- the item is tracked as external follow-up;
- it should identify the expected third party when known;
- it should not enter technician-required work unless a separate follow-up task is assigned;
- missing confirmation does not block the remainder of the workflow.

### Unassigned portal responsibility

When responsibility is unassigned:

- TowerTrack displays `Portal responsibility not assigned`;
- the item enters administrative review or follow-up;
- missing assignment does not block any other operational process;
- an administrator may assign responsibility without changing the sampling clock.

### Not applicable

`NOT_APPLICABLE` may be used only when the active verified profile or specific sample type does not require the portal obligation.

It must not be used merely because the company is not responsible for submission. Customer or third-party responsibility remains an applicable obligation.

### Recommended display

Examples:

- `Routine sample complete — next due August 20`
- `Portal submission due July 25 — assigned to company`
- `Portal submission due July 25 — customer responsibility`
- `Waiting for customer portal confirmation`
- `Portal submission overdue — customer responsibility`
- `Portal submission due — third-party responsibility`
- `Portal responsibility not assigned`
- `Portal submission completed late`
- `Laboratory result pending`

Sampling, portal reporting, and laboratory status must remain separately visible.

## 5. Anti-cascade planning

| Criterion                                           | Status                       | Evidence / limitation                                                                              |
| --------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------- |
| Hard due and internal target are separate           | Implemented                  | Both are displayed and persisted independently.                                                    |
| Stable service pattern is preserved                 | Partially implemented        | Preferred day of month is active; preferred week and weekday fields are stored but not calculated. |
| Early samples do not rewrite preferred pattern      | Implemented                  | Target is recalculated from the stable preference.                                                 |
| Late samples recalculate compliance dates           | Implemented                  | Completion and correction use actual performed date.                                               |
| Unsafe preferred target moves earlier               | Implemented                  | Target is clamped into the safe window.                                                            |
| Recommendation explains why                         | Implemented                  | Every Planning row has a `Why?` disclosure.                                                        |
| Recommendation never falls after hard due           | Implemented                  | Target clamp and client/server route guards enforce this.                                          |
| Portal responsibility does not alter routine target | Implemented as business rule | Portal ownership and reporting state remain independent from routine sampling dates.               |
| Portal lateness does not cascade sampling dates     | Implemented as business rule | The next sample remains anchored to collection date.                                               |

## 6. Planning queue

| Criterion                                                                   | Status                | Evidence / limitation                                                                 |
| --------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------- |
| Defaults to Next 21 Days grouped by route zone                              | Implemented           | Default client scope and grouping match the checklist.                                |
| Customer shown                                                              | Implemented           | Planning location cell.                                                               |
| Building shown                                                              | Implemented           | Planning location cell.                                                               |
| System shown                                                                | Implemented           | Separate row and link per system.                                                     |
| Route zone shown                                                            | Implemented           | Group heading and row text.                                                           |
| Last qualifying sample shown                                                | Implemented           | Date column.                                                                          |
| Internal target shown                                                       | Implemented           | Date column.                                                                          |
| Hard due shown                                                              | Implemented           | Date column remains visible when scheduled.                                           |
| Days remaining shown                                                        | Implemented           | Includes late-day wording.                                                            |
| Status shown                                                                | Implemented           | Text, icon, and color.                                                                |
| Recommended action shown                                                    | Implemented           | Action column.                                                                        |
| Systems enter before urgency                                                | Implemented           | 21-day planning horizon.                                                              |
| Overdue work is prominent                                                   | Implemented           | Red and sorted first inside each route group.                                         |
| Due today is red                                                            | Implemented           | Unit-tested status rule.                                                              |
| Scheduled rows retain hard due                                              | Implemented           | Planned coverage affects status, not deadline calculation.                            |
| Planned sampling is not completion                                          | Implemented           | Clock-reset eligibility requires completed activity.                                  |
| Open portal reporting does not alter next sample due                        | Implemented           | Portal follow-up remains separate.                                                    |
| Customer-assigned portal obligation does not enter technician required work | Needs verification    | External portal ownership should appear as follow-up, not field service.              |
| Unassigned portal responsibility enters review                              | Needs verification    | Missing responsibility should create administrative review without blocking workflow. |
| Portal follow-up can display beside sampling status                         | Partially implemented | Separate requirements exist; verify consistent display across all summary views.      |

## 7. Route grouping

| Criterion                                                        | Status                       | Evidence / limitation                                                                                  |
| ---------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| Manual route zones drive MVP grouping                            | Implemented                  | Building and system route zone is authoritative.                                                       |
| Borough filter                                                   | Implemented                  | Advanced Planning filters.                                                                             |
| County filter                                                    | Implemented                  | Advanced Planning filters.                                                                             |
| Municipality filter                                              | Implemented                  | Advanced Planning filters.                                                                             |
| ZIP filter                                                       | Implemented                  | Advanced Planning filters.                                                                             |
| Technician filter                                                | Implemented                  | Advanced Planning filters.                                                                             |
| Date-range filter                                                | Implemented                  | Hard-due from and through filters.                                                                     |
| Grouping preserves individual deadlines                          | Implemented                  | Rows remain system-specific with unit coverage.                                                        |
| Multi-system building preserves each last sample                 | Implemented                  | Separate Planning rows.                                                                                |
| Multi-system building preserves each hard due                    | Implemented                  | Separate Planning rows.                                                                                |
| Multi-system building preserves each target                      | Implemented                  | Separate Planning rows.                                                                                |
| Multi-system building preserves each status                      | Implemented                  | Separate Planning rows.                                                                                |
| Multi-system building shows planned coverage                     | Implemented                  | Planned visit and date are system-specific.                                                            |
| Deadline outranks efficiency                                     | Implemented                  | Server sorts selected work by due date and blocks late routes.                                         |
| Late route warning                                               | Implemented                  | Inline warning, disabled submit, server revalidation, and Playwright coverage.                         |
| Nearby jobs only suggested when safe                             | Partially implemented        | Recommendation score penalizes unsafe work, but nearby-job suggestion UI is not connected.             |
| Customer portal responsibility does not affect route eligibility | Implemented as business rule | Portal responsibility is not field service unless a separate follow-up visit is intentionally created. |
| Missing portal submission does not block future route creation   | Implemented as business rule | Sampling and route workflow continue independently.                                                    |

## 8. Combining visits

| Criterion                                                  | Status                       | Evidence / limitation                                                               |
| ---------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| App recommends compatible combinations                     | Partially implemented        | Existing planned coverage is highlighted; no general compatibility search exists.   |
| Sample plus inspection                                     | Implemented                  | Independent activities, seed example, and satisfaction badges.                      |
| Sample plus cleaning                                       | Implemented                  | Independent activities and seed example.                                            |
| Sample plus disinfection                                   | Stubbed                      | Activity type exists; no recommendation or creation control.                        |
| Sample plus startup                                        | Stubbed                      | Activity type and window exist; no recommendation or creation control.              |
| Sample plus post-hyperhalogenation follow-up               | Stubbed                      | Activity type and window exists; no recommendation or creation control.             |
| Combined visit shows what it satisfies                     | Implemented                  | Visit activity badges explain clock, inspection, and cleaning effects.              |
| Combined visit shows remaining work                        | Implemented                  | Visit sidebar lists open requirements and dates.                                    |
| Cleaning alone never satisfies Legionella                  | Implemented                  | Type guard and completion tests.                                                    |
| Disinfection alone never satisfies Legionella              | Implemented                  | Type guard.                                                                         |
| Corrective sample needs explicit qualifying flag           | Implemented                  | Corrective type is eligible only when explicitly flagged and completed.             |
| Special-purpose sample needs explicit dual qualification   | Partially implemented        | Qualifying flag exists, but full linked-obligation review workflow remains limited. |
| Portal reporting does not determine sample qualification   | Implemented as business rule | Qualification depends on the sample and linked obligations, not portal completion.  |
| Customer-owned portal work does not block visit completion | Implemented as business rule | The visit closes based on performed activities.                                     |

## 9. Visit completion

| Criterion                                                 | Status                       | Evidence / limitation                                                                                                     |
| --------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Performed date required                                   | Implemented                  | Browser-required field and server validation.                                                                             |
| At least one completed activity required                  | Implemented                  | Server rejects an empty activity selection.                                                                               |
| Sample completion recalculates next hard due              | Implemented                  | Shared completion planner uses actual collection date.                                                                    |
| NYC portal follow-up is due in five days                  | Implemented                  | Persisted blue requirement with unit and Playwright coverage.                                                             |
| Portal follow-up does not block routine recalculation     | Implemented                  | Routine and reporting obligations are processed separately.                                                               |
| Portal responsibility can be selected or inherited        | Needs clarification          | Confirm whether the responsibility comes from customer defaults, contract settings, system settings, or completion input. |
| Customer-owned portal follow-up does not block completion | Implemented as business rule | Visit completion is based on actual performed work.                                                                       |
| Laboratory-result pending status is created               | Implemented                  | Persisted `WAITING_ON_LAB` blue requirement.                                                                              |
| Completion summary is plain English                       | Implemented                  | Visit success message and open-work cards.                                                                                |
| Unchecked Legionella does not reset                       | Implemented                  | Only selected activities are completed.                                                                                   |
| Cancelled or missed visit does not reset                  | Implemented                  | Status and eligibility guards. Dedicated cancel and miss actions are not yet exposed.                                     |
| Completion summary identifies portal responsibility       | Needs verification           | Summary should show company, customer, third-party, or unassigned follow-up.                                              |
| Completion summary explains independent statuses          | Needs verification           | Sampling, portal, and lab states should appear separately.                                                                |

Required completion messaging:

- `Legionella sample completed July 20.`
- `Next routine sample due August 20.`
- `Portal submission due July 25 — customer responsibility.`
- `Laboratory result pending.`

If portal responsibility is assigned to the company:

- `Portal submission due July 25 — assigned to company.`

If responsibility is unassigned:

- `Portal submission due July 25 — responsibility not assigned.`
- `Administrative review required.`

Completing or updating the portal item later must not change the displayed next routine due date.

## 10. NYC supporting logic

| Criterion                                                         | Status                       | Evidence / limitation                                                                                      |
| ----------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 31-day routine sample                                             | Implemented                  | Full scheduling and completion workflow.                                                                   |
| Sample-date portal entry plus five days                           | Implemented                  | Separate persisted reporting requirement.                                                                  |
| Portal entry does not delay routine-date calculation              | Implemented                  | Next due is calculated at qualifying sample completion.                                                    |
| Portal reporting can be customer responsibility                   | Partially implemented        | Business rule is defined; verify data model, UI, and assignment workflow.                                  |
| Customer portal responsibility does not block operations          | Implemented as business rule | Sampling, lab, corrective, route, and future planning continue.                                            |
| 90-day compliance inspection                                      | Partially implemented        | Rule definition and combined activity exist; automatic recurring inspection generation is not implemented. |
| Startup sample 3–14 days after operation                          | Partially implemented        | Tested date-window helper exists; no persisted startup workflow.                                           |
| Startup cleaning and disinfection within 15 days before operation | Stubbed                      | Documented only.                                                                                           |
| Startup reporting plus five days                                  | Stubbed                      | No requirement generator.                                                                                  |
| Shutdown reporting plus five days                                 | Stubbed                      | No requirement generator.                                                                                  |
| Hyperhalogenation July 1–August 31                                | Partially implemented        | Rule definition exists; annual window is not automatically generated.                                      |
| Post-hyperhalogenation sample plus 3 through 31 days              | Partially implemented        | Tested helper exists; no persisted trigger workflow.                                                       |
| Annual certification or non-operation filing by November 1        | Stubbed                      | Documented; no generated requirement.                                                                      |
| High result opens corrective workflow                             | Partially implemented        | Threshold engine and corrective UI or seed exist; lab-result entry does not automatically create a case.   |
| At least three-year retention                                     | Stubbed                      | Policy is documented; no retention enforcement or archive control.                                         |

## 11. Pending regulations

| Criterion                                      | Status          | Evidence / limitation                                                                 |
| ---------------------------------------------- | --------------- | ------------------------------------------------------------------------------------- |
| Pending profile generates no hard due          | Implemented     | Engine and scheduler guard.                                                           |
| Uses `ACTIVE_REQUIRES_RULE_PROFILE_CONVERSION` | Implemented     | Exact enum value exists; no plain `ACTIVE`.                                           |
| Pending items enter Review                     | Implemented     | Seeded review item and purple status.                                                 |
| Admin conversion required when final           | Not implemented | No conversion action or UI.                                                           |
| Conversion previews systems and dates          | Not implemented | No conversion preview.                                                                |
| Conversion preserves history                   | Stubbed         | Architecture requires versioning, but conversion workflow does not exist to prove it. |

## 12. Dummy-proof UI

| Criterion                                                      | Status                 | Evidence / limitation                                                                        |
| -------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| Plain-English labels replace raw enums                         | Implemented            | Shared activity and status label helpers are used across Schedule, Route, Visit, and System. |
| `REQUIRES_REVIEW` says `Needs review`                          | Implemented            | Status engine and badge.                                                                     |
| Routine sample says `Legionella sample`                        | Implemented            | Shared label map.                                                                            |
| Important rows and cards consistently show all context fields  | Partially implemented  | Planning does; secondary pages vary by purpose.                                              |
| Schedule button is obvious                                     | Implemented            | `Add to route` and `Create route`.                                                           |
| Add-to-route button is obvious                                 | Implemented            | Planning action.                                                                             |
| Combine-with-visit button is obvious                           | Partially implemented  | Recommendation and open-visit path exists; no dedicated combination editor.                  |
| Complete-visit button is obvious                               | Implemented            | Visit and Schedule.                                                                          |
| Fix-date button is obvious                                     | Implemented            | System overview.                                                                             |
| View-why control is obvious                                    | Implemented            | `Why?` disclosure.                                                                           |
| Advanced detail is hidden                                      | Partially implemented  | Advanced filters use disclosure; system and visit detail panels are always visible.          |
| Empty states explain the next step                             | Implemented            | Planning, Routes, Schedule, Review, and Customers provide next-action text.                  |
| Sampling and portal statuses are displayed separately          | Partially implemented  | Separate requirements exist; verify all pages avoid one merged misleading status.            |
| Portal responsibility is visible                               | Needs verification     | Portal cards should identify company, customer, third party, or unassigned.                  |
| Customer portal responsibility is not shown as technician work | Needs verification     | External follow-up must not appear as required field activity.                               |
| Unassigned portal responsibility creates review                | Needs verification     | Missing assignment should generate administrative review only.                               |
| Open portal work never disables unrelated workflow actions     | Needs explicit UI test | Buttons for sampling, routing, completion, lab, and corrective work must remain enabled.     |

## 13. Status colors

| Criterion                                                      | Status                | Evidence / limitation                                                                         |
| -------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| Green meaning                                                  | Implemented           | Good, completed, or safely scheduled.                                                         |
| Yellow meaning                                                 | Implemented           | Planning or attention.                                                                        |
| Red meaning                                                    | Implemented           | Due, overdue, or corrective.                                                                  |
| Blue meaning                                                   | Implemented           | Lab, portal, or external follow-up.                                                           |
| Gray meaning                                                   | Implemented           | Inactive, suspended, or cancelled.                                                            |
| Purple meaning                                                 | Implemented           | Review, pending, or ambiguous.                                                                |
| Color is never the only signal                                 | Implemented           | Badges always include icon and text.                                                          |
| Every badge includes text                                      | Implemented           | Component unit coverage.                                                                      |
| Colors are consistent on every named page                      | Partially implemented | Shared badge is consistent where used; Route header and some activity history use plain text. |
| Completed routine sample can remain green while portal is blue | Needs explicit test   | Independent statuses should display together.                                                 |
| Overdue customer portal obligation does not make sampling red  | Needs explicit test   | Only the reporting obligation should become overdue.                                          |
| Unassigned portal responsibility uses review status            | Needs verification    | Purple review may be appropriate while the underlying portal due status remains visible.      |
| Most urgent open item may affect sorting                       | Partially implemented | Sorting may use urgency, but independent statuses must not be collapsed.                      |

## 14. Error prevention

| Criterion                                                     | Status                       | Evidence / limitation                                                  |
| ------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------- |
| Warn on apparent wrong-year sample date                       | Implemented                  | Correction preview warning.                                            |
| Warn when lab date precedes sample                            | Stubbed                      | Tested validation helper exists; no lab-entry form is connected.       |
| Warn when portal date precedes sample                         | Stubbed                      | Tested validation helper exists; no portal-entry form is connected.    |
| Warn if cleaning is marked as satisfying Legionella           | Implemented                  | Visit shows invalid-flag warning and completion refuses to reset.      |
| Warn if NYC profile is outside NYC                            | Implemented                  | Planning rule-assignment warning.                                      |
| Warn if NYS-only interval is 31 days                          | Implemented                  | Profile warning and fixed 90-day calculation.                          |
| Warn if pending regulation creates hard due                   | Implemented                  | Profile warning and scheduling block.                                  |
| Warn if route date misses hard due                            | Implemented                  | Client and server guards with Playwright coverage.                     |
| Prevent completion without performed date                     | Implemented                  | Browser and server validation.                                         |
| Require correction reason                                     | Implemented                  | Minimum length and audit reason.                                       |
| Prevent portal date from changing sampling anchor             | Implemented as business rule | Only qualifying sample collection events determine the routine anchor. |
| Portal responsibility must use allowed values                 | Needs explicit validation    | Reject unsupported ownership values.                                   |
| `NOT_APPLICABLE` cannot replace customer responsibility       | Needs explicit validation    | Lack of company ownership does not make the obligation inapplicable.   |
| Customer-assigned portal work does not block visit completion | Needs explicit test          | Completion must remain enabled.                                        |
| Unassigned portal responsibility does not block workflow      | Needs explicit test          | Review should be non-blocking.                                         |
| Portal lateness does not reopen routine sampling              | Needs explicit test          | Sampling and reporting remain independent.                             |

## 15. Audit and correction

| Criterion                                                     | Status                | Evidence / limitation                                                              |
| ------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------- |
| Corrections are audited                                       | Implemented           | Sample correction transaction.                                                     |
| Voids are audited                                             | Not implemented       | Schema supports void status; no void action or UI.                                 |
| Date changes are audited                                      | Implemented           | Old and new sample and due dates are recorded.                                     |
| Rule-profile changes are audited                              | Not implemented       | No profile-assignment action or UI.                                                |
| Portal completion is retained separately                      | Partially implemented | Portal follow-up exists; full entry form and submission history remain incomplete. |
| Portal responsibility assignment is retained                  | Needs verification    | Data model must store assignment and assignment history.                           |
| Portal responsibility changes are audited                     | Not implemented       | Requires append-only reassignment history.                                         |
| Portal assignment changes do not recalculate sampling         | Needs explicit test   | Ownership affects follow-up only.                                                  |
| Recalculate after sample-date change                          | Implemented           | Correction transaction.                                                            |
| Recalculate after qualifying-flag change                      | Not implemented       | No qualifying-flag edit action.                                                    |
| Recalculate after visit-status change                         | Partially implemented | Completion recalculates; cancel, miss, and void transitions are not exposed.       |
| Recalculate after rule-profile change                         | Not implemented       | No profile-change workflow.                                                        |
| Recalculate after operating-status change                     | Not implemented       | No operating-status edit workflow.                                                 |
| Portal-date correction does not alter routine clock           | Needs explicit test   | Required behavior should be unit-tested.                                           |
| Portal responsibility correction does not alter routine clock | Needs explicit test   | Reassignment must not affect sampling dates.                                       |
| Voiding qualifying sample reopens routine obligation          | Not implemented       | Void workflow is not exposed.                                                      |
| Voiding only portal record reopens reporting, not sampling    | Not implemented       | Requires separate portal void workflow.                                            |
| Correction preview compares old and new due                   | Implemented           | Correction page.                                                                   |
| Historical records are preserved                              | Implemented           | Corrections retain before-and-after audit values.                                  |
| Completed records are not permanently deleted                 | Implemented           | Application write paths do not delete them.                                        |

Portal audit records should retain:

- linked system;
- linked sample;
- collection date;
- portal due date;
- responsibility assignment;
- assignment source;
- assignment history;
- assigned party when known;
- submission status;
- submission date;
- confirmation reference;
- completion timeliness;
- follow-up notes;
- corrections;
- reassignments;
- voids.

## 16. Required tests

| Test                                                                     | Status              | Evidence / limitation                                                    |
| ------------------------------------------------------------------------ | ------------------- | ------------------------------------------------------------------------ |
| NYC 31-day unit test                                                     | Implemented         | `tests/rules.test.ts`.                                                   |
| NYS-only 90-day unit test                                                | Implemented         | `tests/rules.test.ts`.                                                   |
| Stricter Company Policy target unit test                                 | Implemented         | `tests/rules.test.ts`.                                                   |
| Cleaning does not reset unit test                                        | Implemented         | Includes deliberately incorrect qualifying flag.                         |
| Planned visit does not reset unit test                                   | Implemented         | Clock eligibility test.                                                  |
| Completed qualifying sample resets unit test                             | Implemented         | Clock eligibility and completion tests.                                  |
| Completed NYC sample recalculates without portal submission              | Needs explicit test | Confirm collection alone advances routine clock.                         |
| Portal plus five-day unit test                                           | Implemented         | Completion follow-up test.                                               |
| Portal-submission date does not change next sample due                   | Needs explicit test | Next due must remain collection date plus 31 days.                       |
| Late portal submission preserves routine next due                        | Not implemented     | Add test separating reporting lateness from sampling timing.             |
| Customer-assigned portal obligation does not block date recalculation    | Not implemented     | Add responsibility-aware completion test.                                |
| Third-party-assigned portal obligation does not block date recalculation | Not implemented     | Add responsibility-aware completion test.                                |
| Unassigned portal obligation does not block date recalculation           | Not implemented     | Missing ownership must create review only.                               |
| Customer-assigned portal work does not appear in technician queue        | Not implemented     | Add query and UI test.                                                   |
| Reassign customer to company does not change routine due                 | Not implemented     | Add audit and calculation test.                                          |
| Reassign company to customer does not change routine due                 | Not implemented     | Add audit and calculation test.                                          |
| Portal responsibility change is audited                                  | Not implemented     | Add append-only history test.                                            |
| `NOT_APPLICABLE` is rejected when reporting remains required             | Not implemented     | Add validation test.                                                     |
| Voiding portal record does not reopen routine sampling                   | Not implemented     | Requires portal void workflow.                                           |
| Voiding qualifying sample reopens routine sampling                       | Not implemented     | Requires sample void workflow.                                           |
| Missing portal confirmation does not block lab result                    | Not implemented     | Add integration test.                                                    |
| Missing portal confirmation does not block corrective workflow           | Not implemented     | Add integration test.                                                    |
| Missing portal confirmation does not block route creation                | Not implemented     | Add browser test.                                                        |
| Missing portal confirmation does not block future sampling               | Not implemented     | Add planning and route test.                                             |
| Route grouping preserves deadlines unit test                             | Implemented         | Route and two-tower acceptance tests.                                    |
| Pending rule has no hard due unit test                                   | Implemented         | Profile test.                                                            |
| NYC rule is not applied out of state                                     | Implemented         | Geography warning and fixed interval tests.                              |
| Planning Playwright test                                                 | Implemented         | Due work and `Why?` disclosure.                                          |
| Route creation Playwright test                                           | Implemented         | Two systems become one building stop.                                    |
| Late-route warning Playwright test                                       | Implemented         | Warning and disabled submit.                                             |
| Technician completion Playwright test                                    | Implemented         | Actual activity completion.                                              |
| Next due recalculation Playwright test                                   | Implemented         | Exact collection date plus 31 display.                                   |
| Portal-pending Playwright test                                           | Needs explicit test | Confirm next due recalculates while portal remains open.                 |
| Customer-portal-responsibility Playwright test                           | Not implemented     | Confirm external status and unrestricted operational actions.            |
| Unassigned-portal-responsibility Playwright test                         | Not implemented     | Confirm review status without workflow blocking.                         |
| Portal-overdue Playwright test                                           | Not implemented     | Confirm sampling date remains unchanged while reporting becomes overdue. |
| Why explanation Playwright test                                          | Implemented         | Planning workflow.                                                       |

## 17. Final acceptance flow

| Step                                                       | Status                         | Evidence / limitation                                                           |
| ---------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------- |
| NYC building with two systems                              | Implemented                    | Fictional Harborview seed.                                                      |
| Different initial qualifying sample dates                  | Implemented                    | June 20 and June 25 in seed and acceptance unit test.                           |
| Separate Planning rows                                     | Implemented                    | Both are selected independently in Playwright.                                  |
| Separate 31-day hard dates                                 | Implemented                    | July 21 and July 26 in acceptance unit test.                                    |
| Same route zone                                            | Implemented                    | Downtown Brooklyn.                                                              |
| Urgent system can be added to route                        | Implemented                    | Planning selection.                                                             |
| Late route produces warning                                | Implemented                    | Client, server, and Playwright.                                                 |
| Complete with Legionella checked                           | Implemented                    | Playwright.                                                                     |
| Next hard due recalculates immediately                     | Implemented                    | July 20 collection produces August 20.                                          |
| Portal follow-up plus five days                            | Implemented                    | July 25 is persisted and displayed.                                             |
| Portal responsibility is assigned                          | Needs verification             | Acceptance data should include company, customer, or unassigned responsibility. |
| Customer responsibility does not block next due            | Needs explicit acceptance test | August 20 must remain authoritative.                                            |
| Customer responsibility does not block lab workflow        | Needs explicit acceptance test | Lab result entry remains available.                                             |
| Customer responsibility does not block corrective workflow | Needs explicit acceptance test | High results still create required actions.                                     |
| Customer responsibility does not block future routes       | Needs explicit acceptance test | System remains eligible for future routine scheduling.                          |
| Unassigned portal responsibility creates review only       | Needs explicit acceptance test | Operational workflow remains enabled.                                           |
| Portal lateness does not change August 20 due              | Not implemented                | Add acceptance coverage.                                                        |
| Portal reassignment does not change August 20 due          | Not implemented                | Add acceptance coverage.                                                        |
| Green, yellow, red, blue, gray, and purple statuses        | Implemented                    | Shared component and rule coverage.                                             |
| Sampling and portal statuses can display together          | Partially implemented          | Separate requirements exist; verify all summary pages.                          |
| Portal responsibility appears in plain English             | Needs verification             | UI should state company, customer, third party, or unassigned.                  |
| Why explanation                                            | Implemented                    | Planning disclosure and test.                                                   |

## Revised final acceptance scenario

1. Begin with an NYC building containing two cooling-tower systems.
2. Each system has its own last qualifying routine sample.
3. Each system has its own 31-day hard due date.
4. Both systems remain separate Planning rows even when sharing a building and route zone.
5. Add the urgent system to a route.
6. Verify that a route date after the hard due date is blocked.
7. Complete the visit with `Legionella sample` selected.
8. Enter the actual sample collection date.
9. Verify immediately that:

   - the routine sampling obligation closes;
   - the next hard due equals collection date plus 31 calendar days;
   - a portal-reporting obligation is created due collection date plus five calendar days;
   - a laboratory-result-pending requirement is created.

10. Assign the portal-reporting obligation to the customer.
11. Verify that the UI displays:

- `Routine sample complete`;
- `Next routine sample due [date]`;
- `Portal submission due [date] — customer responsibility`;
- `Laboratory result pending`.

12. Verify that the customer-owned portal obligation does not appear as technician-required field work.
13. Verify that laboratory-result entry remains available.
14. Verify that corrective workflow remains available.
15. Verify that future route and sampling workflows remain available.
16. Leave the portal requirement incomplete.
17. Advance beyond the portal deadline.
18. Verify that:

- the portal-reporting obligation becomes overdue;
- the responsibility remains visibly assigned to the customer;
- the routine sample remains complete;
- the next routine due remains collection date plus 31 days;
- no operational workflow becomes blocked.

19. Reassign portal responsibility from customer to company.
20. Verify that:

- the reassignment is audited;
- the item may enter the company follow-up queue;
- the routine sampling date does not change.

21. Complete the portal-reporting obligation.
22. Verify that:

- the portal obligation closes as completed on time or completed late;
- the next routine due date does not change;
- the portal submission date does not become the routine anchor.

23. Correct the portal-submission date.
24. Verify that only portal timeliness and audit history change.
25. Correct or void the underlying qualifying sample.
26. Verify that the routine sampling clock and affected downstream dates are replayed.
27. Create another sample with portal responsibility left unassigned.
28. Verify that:

- `Portal responsibility not assigned` appears;
- the item enters administrative review;
- sampling, laboratory, corrective, route, and visit workflows remain enabled.

## Remaining MVP-adjacent priorities

1. Add explicit tests proving that qualifying NYC sample completion recalculates the next routine due date before portal reporting is completed.
2. Add portal responsibility fields supporting company, customer, third party, unassigned, and not applicable.
3. Define how responsibility is inherited from customer, contract, building, system, or obligation defaults.
4. Add safeguards preventing `NOT_APPLICABLE` from being used merely because submission is customer responsibility.
5. Ensure customer- and third-party-assigned portal obligations do not enter technician-required work.
6. Add administrative review for unassigned portal responsibility without blocking workflow.
7. Add tests proving that portal completion, lateness, correction, reassignment, or voiding does not alter the routine sampling clock.
8. Ensure all UI summary views display routine sampling, portal reporting, responsibility, and laboratory follow-up as independent statuses.
9. Add portal entry, correction, completion, late-completion, reassignment, and void workflows.
10. Build audited admin workflows for rule-profile and operating-status changes with recalculation previews.
11. Add cancel, miss, void, and undo actions with audit events.
12. Connect the compatibility and recommendation engine to a real `Combine with visit` editor.
13. Turn startup, shutdown, hyperhalogenation, annual certification, and inspection helpers into persisted requirement generators.
14. Add laboratory-entry forms using existing date-sequence validators and automatic corrective-case creation.
15. Replace all remaining `before heat load` startup wording with `before startup and within the 15 calendar days preceding operation`.
16. Add timezone-aware timestamp handling and tests for 24-hour and 48-hour corrective deadlines.
