# TowerTrack business rules

TowerTrack is an internal operational scheduling, compliance-tracking, and workflow-support application. It is not legal advice, does not independently determine legal responsibility, and does not replace the judgment of a qualified person.

A qualified person must review ambiguous compliance decisions, treatment decisions, unusual operating conditions, conflicting records, and any workflow marked for review.

## Rule profile selection

Every cooling-tower system owns one active, versioned rule profile.

- NYC systems use `NYC_CHAPTER_8_2026_PLUS_NYS_PART_4`.
- New York systems outside NYC use `NYS_PART_4_ONLY`.
- Systems outside New York default to a Company Policy profile unless a verified custom jurisdictional profile exists.
- Guidance, draft, monitoring, and pending-regulation profiles must never masquerade as active regulatory rules.
- A pending or unverified profile creates a purple review item rather than a hard compliance deadline.
- Every active regulatory rule must retain its authority, jurisdiction, source reference, effective date, profile version, verification status, and administrator approval.
- A system may change profiles only through an audited profile-change event.
- Profile changes must trigger a preview and replay of affected obligations.
- Task ownership and responsibility labels organize operational follow-up only.
- Operational responsibility labels do not establish legal, contractual, statutory, or regulatory responsibility.

## Operating status

Routine operating-period obligations depend on the system’s verified operating status.

- Decommissioned systems and systems in a verified full shutdown suspend routine operating-period obligations.
- For NYC systems, a full shutdown requires the cooling-tower system to be completely drained of water and protected from offline contamination.
- A seasonal, idle, standby, unavailable, customer-reported inactive, or manually paused status does not suspend NYC obligations unless the verified shutdown conditions are satisfied.
- Once water is present in any portion of an NYC cooling-tower system, the system is treated as operating.
- Operation of any portion of an NYC system places the cooling-tower system in operating status.
- New York systems outside NYC follow the operating and shutdown definitions in their active verified profile.
- Out-of-state and Company Policy profiles use their configured operating-status rules.
- A change in operating status must be recorded as an append-only operating-state event with an effective date, reason, user, and supporting notes.
- Correcting an operating-state event must replay all affected obligations.

## Legionella routine clock

### NYC systems

- NYC operating systems have a hard routine sampling due date equal to the last completed qualifying routine sample collection date plus 31 calendar days.
- The routine sampling clock advances immediately when a qualifying sample collection is completed.
- Portal submission is not required before TowerTrack calculates the next routine sampling due date.
- The 31-day interval is calculated from the qualifying sample’s collection date.
- The interval is not calculated from:

  - the portal-submission date;
  - the portal-confirmation date;
  - the laboratory-receipt date;
  - the laboratory-result date;
  - the result-review date;
  - the result-upload date;
  - the portal result-entry date.

- A sample does not reset TowerTrack’s routine Legionella clock merely because it was scheduled, assigned, delivered to a laboratory, received by a laboratory, resulted, reviewed, or linked to a laboratory record.

The routine sampling clock resets only when all of the following are true:

1. The sample collection activity is completed.
2. The actual sample collection date is recorded.
3. The sample is explicitly designated as qualifying for the routine Legionella sampling obligation.
4. The sample is linked to the correct cooling-tower system.
5. The sample is linked to the applicable routine sampling obligation.

When those conditions are met:

- the routine sampling obligation closes;
- the next routine hard due date is calculated immediately;
- the next routine due date equals the sample collection date plus 31 calendar days;
- portal reporting may remain open;
- laboratory follow-up may remain open;
- corrective obligations may later be generated independently.

A missing, late, customer-assigned, third-party-assigned, or unassigned portal obligation does not prevent the routine clock from advancing.

Correcting, reassigning, completing, or voiding only the portal-reporting record does not change the routine sampling clock.

The routine sampling clock changes only when the underlying qualifying sample is:

- corrected;
- voided;
- canceled;
- linked to the wrong system;
- determined not to qualify;
- otherwise invalidated through an audited event.

### NYS-only systems

- NYS-only operating systems have a hard routine sampling due date equal to the last qualifying Legionella sample collection date plus 90 calendar days.
- A completed qualifying sample collection resets the NYS-only routine clock unless the active verified profile explicitly establishes a different qualifying condition.
- Reporting and state-submission requirements remain separate obligations unless the active profile explicitly states otherwise.
- Reporting completion must not be assumed to control the sample collection date used for routine calculations unless a verified rule specifically requires that behavior.

### Out-of-state and custom profiles

- Out-of-state systems use the active Company Policy or verified custom interval.
- The seed Company Policy interval is 90 calendar days.
- Company Policy dates must be clearly labeled as Company Policy and never presented as statutory or regulatory deadlines.
- Guidance and verified custom profiles use their configured intervals and retain their authority labels.
- Each custom profile must explicitly define:

  - which sample types qualify;
  - which completion event advances the routine clock;
  - whether reporting is a separate obligation;
  - whether any reporting confirmation affects obligation closure;
  - the authority label attached to the requirement.

### Sample qualification

- Only a completed sample event explicitly marked as qualifying may satisfy a routine sampling obligation.
- Startup, corrective, emergency, hyperhalogenation-follow-up, DOH-directed, biological-indicator-triggered, and other special-purpose samples remain separate obligations.
- A special-purpose sample resets the routine clock only when:

  - the active verified rule permits dual qualification;
  - the sample meets the requirements of both obligations;
  - the sample is explicitly linked to both obligations;
  - a qualified user confirms the dual qualification when required.

- Portal reporting does not determine whether the sample qualifies for the routine sampling clock.
- TowerTrack may recommend that one sample could satisfy multiple obligations, but it must not automatically close multiple obligations without explicit qualification.

## Portal-reporting obligations

Routine sampling and portal reporting are separate obligations.

### NYC sample-date portal entry

- A qualifying NYC Legionella sample creates a portal-reporting obligation due five calendar days after the sample collection date.
- The portal due date equals collection date plus five calendar days.
- Portal reporting does not block the routine sampling clock.
- Portal reporting does not delay calculation of the next routine sampling due date.
- Portal reporting does not replace the sample collection date as the routine sampling anchor.
- An unreported sample may satisfy the routine sampling obligation while leaving the portal-reporting obligation open.
- A late portal submission must remain visible as a late reporting record.
- A late portal submission does not reopen the completed routine sampling obligation.
- Correcting the portal submission date affects portal timeliness only.
- Correcting or voiding only the portal record does not alter the routine sampling clock.
- A portal submission must be linked to the exact system and sample collection event it reports.

### Portal operational responsibility

Every portal-reporting obligation must support one operational responsibility assignment:

- `COMPANY`
- `CUSTOMER`
- `THIRD_PARTY`
- `UNASSIGNED`
- `NOT_APPLICABLE`

Responsibility assignment identifies who is expected to perform or confirm the portal submission.

It is an operational coordination field and does not determine legal responsibility.

### Company responsibility

When portal reporting is assigned to the company:

- the item may enter the company’s actionable follow-up queue;
- internal reminders and overdue escalations may be generated;
- an assigned employee or team may complete the portal submission;
- TowerTrack should record the submission date and confirmation reference when available.

### Customer responsibility

When portal reporting is assigned to the customer:

- the portal obligation is tracked as external follow-up;
- it does not enter the technician’s required field-service queue;
- TowerTrack may generate a reminder to request or verify confirmation;
- missing customer confirmation does not block:

  - laboratory-result entry;
  - corrective-action generation;
  - routine sampling;
  - route creation;
  - visit completion;
  - future scheduling;
  - other operational workflows.

- The UI must clearly identify the obligation as customer responsibility.

### Third-party responsibility

When portal reporting is assigned to another third party:

- the obligation is tracked as external follow-up;
- the expected third party should be identified when known;
- the item does not enter technician-required work unless a separate follow-up task is created;
- missing confirmation does not block unrelated workflows.

### Unassigned responsibility

When portal responsibility is unassigned:

- TowerTrack displays `Portal responsibility not assigned`.
- The item enters administrative review or follow-up.
- Missing assignment does not block any other workflow.
- An administrator may assign responsibility without changing the routine sampling clock.

### Not applicable

`NOT_APPLICABLE` may be used only when the active verified profile or sample type does not require portal reporting.

It must not be used merely because the company is not responsible for submission.

Customer or third-party responsibility remains an applicable portal obligation.

### Portal workflow behavior

- Portal reporting never blocks calculation of the next routine sampling due date.
- Portal reporting never blocks laboratory-result entry.
- Portal reporting never blocks corrective-action generation.
- Portal reporting never blocks route creation.
- Portal reporting never blocks visit completion.
- Portal reporting never blocks future routine sampling.
- Portal reporting never blocks startup, shutdown, inspection, cleaning, disinfection, certification, or treatment workflows.
- Missing portal confirmation must not disable unrelated UI actions.
- Reassigning portal responsibility does not affect sampling dates.
- Completing portal reporting does not affect sampling dates.
- Correcting portal reporting does not affect sampling dates.
- Voiding only the portal record does not affect sampling dates.

## Date and time handling

- Calendar-based obligations use authoritative date-only values.
- Date-only values are represented as ISO `YYYY-MM-DD` strings in the rule engine and PostgreSQL `date` columns in persistence.
- Calendar-day and business-day calculations use date-only helpers so a timezone conversion cannot move a compliance date.
- `America/New_York` is the default operational and display timezone for NYC and New York profiles.
- Hour-based obligations use timezone-aware timestamps.
- Hour-based obligations include, but are not limited to:

  - 24-hour notification;
  - 24-hour disinfection;
  - 48-hour full remediation;
  - 48-hour bacteriological-indicator retesting.

- Date-only helpers must not be used to calculate hour-based corrective deadlines.
- The triggering timestamp, source, and operational timezone must be stored for every hour-based obligation.
- Relative labels such as `today`, `tomorrow`, `in 3 business days`, and `overdue by 2 days` are display aids only.
- The underlying absolute date or timestamp remains authoritative.

## Compliance deadline versus stable operational target

The hard compliance date and the preferred operational target are separate.

- The hard date follows the last qualifying event and the active rule profile.
- The operational target follows a stable system preference such as:

  - preferred day of month;
  - preferred week of month;
  - preferred service weekday;
  - fixed service route day.

- An early or late sample updates the hard date without rewriting the stable operational preference.
- If the stable target falls after the hard deadline, TowerTrack moves the recommendation earlier.
- A stricter Company Policy target is displayed separately and must never be relabeled as law.
- The source of every date must be visible as Regulatory, Company Policy, Guidance, or Manual Review.
- Portal responsibility and portal completion status do not change the hard sampling date or stable operational target.

Default planning values are:

- Planning horizon: 21 calendar days.
- Warning threshold: 7 calendar days.
- Critical threshold: 3 calendar days.
- Earliest useful date: hard due minus 21 calendar days.
- Latest safe date: hard due minus 3 calendar days.

The recommended target is clamped into the safe scheduling window.

- TowerTrack may recommend work before the earliest useful date only when another valid workflow, route, shutdown, startup, corrective, or customer constraint justifies it.
- A recommendation must never move after the hard deadline merely to improve route grouping or multi-obligation coverage.
- Portal lateness must not cascade into or shift future routine sampling dates.

## Status and color

| Color  | Plain-English meaning                                                                                                |
| ------ | -------------------------------------------------------------------------------------------------------------------- |
| Green  | Complete or safely scheduled                                                                                         |
| Yellow | Ready to schedule or due soon                                                                                        |
| Red    | Due today, overdue, scheduled late, or corrective deadline critical                                                  |
| Blue   | Waiting on laboratory, portal, owner, customer, regulator, or another third party                                    |
| Gray   | Inactive, suspended, cancelled, voided, or not applicable                                                            |
| Purple | Qualified-person review, conflicting data, unverified rule, pending regulation, or missing responsibility assignment |

Color must always be paired with plain-English text.

### Independent obligation status

Sampling, portal reporting, laboratory follow-up, corrective work, inspection, and other obligations must be evaluated separately.

A completed routine sampling obligation may be green while:

- portal reporting remains blue;
- portal reporting is red because it is overdue;
- laboratory results remain blue;
- a corrective obligation is red;
- portal responsibility review is purple.

An overdue portal obligation must not make a completed routine sampling obligation appear overdue.

A completed routine sampling obligation must not make an open portal obligation appear complete.

### Obligation status order

Obligation status is evaluated independently from scheduling coverage.

Safety order:

1. Inactive, suspended, voided, or not applicable.
2. Qualified-person review, conflicting information, unverified rule, or missing responsibility assignment.
3. Completed.
4. Overdue.
5. Due today.
6. Critical.
7. Warning.
8. Planning.
9. Future.

A scheduled visit must never change an overdue obligation to green.

### Scheduling coverage

Scheduling coverage is shown as a secondary state:

- Unscheduled.
- Safely scheduled.
- Scheduled before useful window.
- Scheduled after latest safe date.
- Scheduled after hard deadline.
- Completed.
- Cancelled.
- Voided.

Examples:

- `Overdue — scheduled for July 23`
- `Due soon — safely scheduled`
- `Scheduled after deadline`
- `Routine sample complete — next due August 20`
- `Portal submission due July 25 — customer responsibility`
- `Portal submission overdue — customer responsibility`
- `Portal responsibility not assigned`
- `Completed — awaiting laboratory result`
- `Completed late`

Planned, assigned, or scheduled work never advances a compliance clock.

## Supporting windows

### Inspections

- NYC compliance inspection: at least once every 90 days while the cooling-tower system is operating.
- An NYC compliance inspection does not by itself create or satisfy a separate Legionella sample obligation.
- The planner may suggest bundling an inspection with an open sample obligation when the proposed visit date falls within both valid windows.
- NYS inspection: before seasonal startup and at intervals not exceeding 90 days while the system is in use.
- Year-round NYS systems also require inspection before startup following maintenance when required by the active profile.
- For NYC systems subject to both NYC and NYS requirements, one inspection event may be linked to both obligations when it satisfies both rules.
- Each underlying authority and obligation must remain separately visible.

### NYS bacteriological sampling

- NYS bacteriological sample interval: every 30 days unless the active verified profile establishes another applicable interval.
- Bacteriological sampling and Legionella sampling are distinct obligations.
- A bacteriological sample never resets the Legionella routine clock.

### Startup

- NYC startup cleaning and disinfection must be completed before startup and within the 15 calendar days preceding operation.
- The startup cleaning and disinfection event is stored separately from the startup or operation event.
- Startup cleaning and disinfection never substitutes for the recorded startup date.
- NYC startup Legionella sample: collect no earlier than three calendar days and no later than 14 calendar days after startup or operation.
- NYS seasonal-startup Legionella sample: collect no later than 14 calendar days after startup.
- The NYS rule does not create a three-day minimum unless another applicable profile imposes one.
- For NYC systems, the stricter NYC `+3 through +14 days` window controls.
- A startup sample satisfies the routine clock only when explicitly dual-qualified.
- Portal reporting generated by the startup sample remains a separate obligation.
- Startup portal responsibility may be assigned to the company, customer, third party, or administrative review.
- Missing startup portal reporting does not block the next sampling calculation or other operational workflows.
- Startup obligations remain separate even when one sample or visit can satisfy multiple requirements.

### Routine cleaning

- Routine cleaning does not create a Legionella sample window unless an active verified profile explicitly says otherwise.
- Routine cleaning never resets the routine Legionella sampling clock.
- Cleaning, disinfection, hyperhalogenation, inspection, treatment, and sampling are distinct activities.
- One activity must not be substituted for another without an explicit qualifying rule.

### NYC summertime hyperhalogenation

- The annual NYC hyperhalogenation period is July 1 through August 31.
- The hyperhalogenation event must remain separate from routine cleaning and routine disinfection.
- Follow-up Legionella sampling is due no earlier than three calendar days and no later than 31 calendar days after hyperhalogenation.
- The required declaration is due within 30 calendar days.
- The follow-up sample resets the routine sampling clock only if it is explicitly dual-qualified.
- Portal reporting associated with the follow-up sample remains separate and non-blocking.
- Hyperhalogenation alone never closes a routine sampling obligation.
- Cleaning performed with or near hyperhalogenation remains an independent activity and obligation.

### Annual certification

- NYS annual certification is due by November 1 each year.
- NYC systems remain subject to the applicable state annual-certification requirement.
- Annual certification must be tracked separately from NYC portal activities, MPP review, inspections, and routine sampling.
- A certification record must retain the certification period, submission date, authority, submitter, and confirmation reference when available.
- Responsibility for annual certification may be tracked operationally without determining legal responsibility.
- Missing or externally assigned annual certification follow-up does not alter unrelated routine sampling dates.

### No circulation

- For NYC systems, when no circulation lasts three days or more in any portion of the system, TowerTrack creates an obligation to perform and document the applicable MPP risk-management procedures.
- This is not merely a review reminder.
- When no circulation lasts five days or more, TowerTrack requires cleaning and disinfection before the affected portion or system returns to operation.
- The return-to-operation event must remain blocked until the required cleaning and disinfection is completed or a qualified-person override is recorded.
- No-circulation duration is calculated from operating-state events.
- Correcting the beginning or end of the no-circulation period must replay all affected obligations.

## Corrective levels

Laboratory results must be associated with the exact system, sample collection event, collection date, laboratory record, and applicable open obligation before they generate or close corrective work.

Portal-reporting status must not prevent laboratory-result entry or corrective-action generation.

### Level 1

- Below 10 CFU/mL and not detected: maintain the normal water-treatment program, water chemistry, and biocide levels.
- Detected below 10 CFU/mL: create a qualified-person treatment-program review.
- The review must document whether water chemistry, biocide levels, dosing, bleed-off, or another treatment control requires adjustment.
- A detected-below-10 result does not automatically create the higher corrective actions used for Levels 2 through 4.

### Level 2

- 10 CFU/mL to below 100 CFU/mL:

  - initiate required disinfection within 24 hours;
  - review the treatment program;
  - create a Legionella retest obligation due no earlier than three days and no later than seven days after the qualifying corrective action.

### Level 3

- 100 CFU/mL to below 1,000 CFU/mL:

  - perform all Level 2 actions;
  - perform and document a visual inspection;
  - create a Legionella retest obligation due no earlier than three days and no later than seven days after the qualifying corrective action.

### Level 4

- 1,000 CFU/mL or greater:

  - notify NYC DOHMH within 24 hours after receipt of the laboratory result;
  - initiate required disinfection within 24 hours after receipt of the result;
  - complete required full remediation within 48 hours after receipt of the result;
  - create a Legionella retest obligation due no earlier than three days and no later than seven days after the qualifying remediation action.

The Level 4 workflow must capture:

- laboratory result received timestamp;
- person or system that received the result;
- notification due timestamp;
- disinfection due timestamp;
- remediation due timestamp;
- actual completion timestamps;
- notification confirmation;
- supporting records.

### Corrective-result chain

- Every Level 2, Level 3, or Level 4 result creates a new three-to-seven-day retest obligation.
- A corrective retest is a separate sample obligation.
- Subsequent results continue the corrective chain until a Level 1 result closes it.
- Closing the corrective chain does not automatically close the routine sample obligation.
- A corrective sample may reset the routine clock only when it is explicitly dual-qualified.
- Portal reporting generated by that corrective sample remains a separate non-blocking obligation.
- Each result in the chain must retain its parent sample, prior result, generated actions, retest obligation, and closure reason.
- Missing portal reporting must never prevent corrective-chain continuation.

## Emergency and manual risk triggers

The following conditions may create an emergency Legionella sample obligation:

- power failure sufficient to permit microbial growth;
- loss or interruption of biocide feed;
- conductivity-control failure;
- a DOH-directed sample;
- another DOH-directed condition;
- an MPP-defined trigger;
- a qualified manual risk event.

Rules:

- The engine displays `Schedule immediately` when the applicable authority or configured MPP requires prompt action but does not provide an exact legal deadline.
- TowerTrack must not invent a precise statutory deadline when none is stated in the active verified profile.
- A Company Policy target may be added, but it must be labeled Company Policy.
- The trigger event, reason, qualified-person review, and resulting obligation must be retained.
- An emergency sample does not automatically reset the routine sampling clock.
- It resets the routine clock only when explicitly dual-qualified.
- Portal reporting associated with an emergency sample remains separate and non-blocking.

## Biological-indicator trigger

A weekly biological-indicator result at or above 10,000 CFU/mL creates a biological-indicator corrective chain.

TowerTrack must generate and track:

- disinfectant-residual monitoring three times per day;
- treatment-program quality-control review;
- review and adjustment of dosing, chemicals, biocides, bleed-off, or other applicable process controls;
- documentation of the target residual;
- documentation of whether the target residual was achieved and maintained for at least 24 hours within three days.

If the target residual is not achieved and maintained for at least 24 hours within three days:

- create an immediate Legionella sampling obligation;
- preserve the exact reason the obligation was triggered;
- do not invent an exact statutory deadline unless the active profile provides one.

After the target residual is achieved:

- create a bacteriological-indicator retest obligation due 48 hours later;
- use a timezone-aware timestamp for the 48-hour deadline;
- continue the indicator corrective chain until a Level 1 indicator result is reached.

A Legionella sample created by the biological-indicator workflow does not automatically reset the routine Legionella clock.

It may reset the routine clock only when explicitly dual-qualified.

Any portal-reporting obligation generated from that sample remains separate and non-blocking.

## Event ledger, replay, and source of truth

The append-only domain-event ledger is the source of truth for obligation projection.

Distinct event categories include:

- service events;
- sample collection events;
- laboratory receipt events;
- laboratory result events;
- portal submission events;
- portal confirmation events;
- portal responsibility assignment events;
- portal responsibility reassignment events;
- inspection events;
- cleaning events;
- disinfection events;
- hyperhalogenation events;
- treatment-review events;
- operating-state events;
- startup events;
- shutdown events;
- corrective-action events;
- notification events;
- annual-certification events;
- corrections;
- voids;
- reversing or undo events.

Derived records include:

- sampling obligations;
- inspection obligations;
- reporting obligations;
- corrective-action obligations;
- laboratory-result chains;
- operating periods;
- scheduling recommendations;
- plain-English compliance statuses;
- route candidates;
- deadline warnings;
- responsibility-aware follow-up items.

Rules:

- A laboratory result must not be modeled only as a generic service event.
- A portal submission must not be inferred from sample completion.
- Portal reporting must remain separate from sample qualification.
- A portal confirmation must be stored as its own auditable fact.
- Portal responsibility assignment and reassignment must be auditable.
- Changing portal responsibility must not replay or alter the routine sampling clock.
- Derived obligations and statuses must be rebuildable from authoritative active events.
- Replaying the event ledger must produce the same current projection.
- A correction marks the old event corrected and appends a replacement event.
- A void request marks the original event voided rather than physically deleting it.
- Corrected and voided events remain in the audit history but do not remain active inputs to the current projection.
- Every correction and void requires a reason.
- Every replay records which obligations were created, closed, reopened, moved, or removed.

## Combining obligations and visits

Each activity remains independent inside a multi-activity visit.

- The overlap engine recommends an existing visit only when the proposed date falls within the valid safe window for every obligation it is expected to satisfy.
- Cleaning alone never closes a sampling obligation.
- Disinfection alone never closes a sampling obligation.
- Hyperhalogenation alone never closes routine cleaning or routine sampling.
- Inspection alone never closes a sampling obligation.
- A sample does not close a cleaning, disinfection, inspection, certification, or portal obligation.
- One visit may complete multiple activities, but each activity must be separately selected, completed, documented, and linked to its obligation.
- TowerTrack must preserve a separate source, authority, deadline, status, qualifying rule, responsibility assignment, and evidence record for every obligation.
- The UI must state directly whether one proposed visit can complete multiple obligations.
- A potential combination must never outrank a hard deadline.
- A potential dual-qualifying sample must be presented as a recommendation requiring confirmation, not as an automatic closure.
- Customer- or third-party-assigned portal work does not prevent completion of the visit.
- Portal reporting should not be treated as field activity unless it is intentionally assigned as a separate company task.

## Routes

- Route grouping uses the manually assigned route zone.
- Manual route zones are authoritative for MVP grouping.
- Stored addresses and coordinates support future routing and mapping.
- Coordinates do not override the manually assigned route zone unless an administrator activates an approved automated-routing feature.
- Every system retains its own row, deadline, obligation status, and completion record even when multiple systems share one visit.
- Route creation blocks a proposed date after any selected system’s hard deadline unless the user removes that system or records an authorized override.
- A route optimization benefit must never cause an obligation to be scheduled after its hard date.
- Missing, late, customer-assigned, third-party-assigned, or unassigned portal reporting does not block route creation.
- Customer portal responsibility does not place portal submission in a technician route unless a separate field or follow-up task is intentionally created.

## Recommendation scoring

The recommendation score is transparent:

- Deadline urgency: 0 to 50 points.
- Multi-obligation coverage: 15 points per compatible obligation, capped at 30 points.
- Route match: 15 points.
- Stable target match: 0 to 10 points.
- Technician availability: 5 points.
- Risk penalty:

  - minus 100 points if after the hard deadline;
  - minus 30 points if after the latest safe date.

Rules:

- A date after the hard deadline is not a valid recommendation.
- A date after the latest safe date may appear only as a warning or exception candidate.
- Hard deadlines always outrank route matching, stable targets, technician convenience, and combination opportunities.
- The UI must explain the score in plain English.
- The recommendation engine must not present Company Policy preferences as legal requirements.
- Portal ownership must not affect the routine sampling recommendation score.
- Portal follow-up may have its own responsibility-aware priority without changing the sampling recommendation.

## Corrections

Corrections are append-only audit events.

- Every correction requires a reason.
- A correction preview compares:

  - old and new dates;
  - timestamps;
  - statuses;
  - authority;
  - active profile;
  - qualifying flags;
  - portal-reporting status;
  - portal responsibility;
  - affected obligations;
  - downstream deadlines;
  - result chains;
  - route assignments.

- Completed compliance records are corrected or voided, never hard-deleted.
- Undo creates a reversing audit event rather than deleting the correction.

Correcting a sample collection date must replay:

- portal-entry deadlines;
- routine sampling deadlines;
- startup windows;
- corrective retest windows;
- linked result chains;
- scheduling recommendations.

Correcting or voiding only a portal submission must affect:

- portal timeliness;
- portal completion status;
- portal audit history;
- portal follow-up status.

Correcting or voiding only a portal submission must not affect:

- the routine sampling anchor;
- the next routine sampling due date;
- the completed routine sample status;
- unrelated laboratory or corrective workflows.

Changing portal responsibility must:

- be audited;
- update the appropriate work or follow-up queue;
- preserve assignment history;
- leave the routine sampling clock unchanged.

Correcting a laboratory result may create, change, close, or reopen a corrective chain.

Correcting an operating-state event may create or remove routine, shutdown, startup, and no-circulation obligations.

The UI must show the expected downstream impact before a correction is committed.

## Dummy-proof interaction rules

The Planning queue leads with:

- issue;
- system and location;
- authority;
- hard due date;
- latest safe date;
- current status;
- next required action;
- scheduling coverage;
- combination opportunity;
- a plain-English `Why?` explanation.

Interaction rules:

- Color is always paired with text.
- Regulatory, Company Policy, Guidance, and Manual Review dates are visibly distinguished.
- Routine sampling, portal reporting, laboratory follow-up, and corrective obligations are displayed separately.
- A completed qualifying sample must advance the routine sampling clock immediately.
- An open portal obligation must not make the completed routine sample appear incomplete.
- An overdue portal obligation must not make the routine sampling obligation appear overdue.
- A customer-assigned portal obligation must be visibly labeled `Customer responsibility`.
- A third-party-assigned portal obligation must identify the responsible party when known.
- An unassigned portal obligation displays `Portal responsibility not assigned`.
- Unassigned portal responsibility enters administrative review without blocking unrelated work.
- Customer- and third-party-assigned portal work does not appear as required technician field work.
- Missing portal reporting does not disable:

  - route creation;
  - visit completion;
  - laboratory entry;
  - corrective workflow;
  - future sampling;
  - startup or shutdown workflow.

- A scheduled visit must not hide that an obligation is overdue.
- Route creation blocks a date after any selected system’s hard due date.

Visit completion asks for:

- performed date;
- actual activities completed;
- affected systems;
- required qualifying details;
- supporting notes or evidence when needed.

After sample completion, TowerTrack explains:

- which sampling obligations were satisfied;
- the next routine sampling due date;
- which portal-reporting obligations were created;
- who is operationally responsible for portal reporting;
- which laboratory follow-ups remain open;
- which corrective obligations remain or may be created.

Recommended completion wording:

- `Legionella sample completed July 20.`
- `Next routine sample due August 20.`
- `Portal submission due July 25 — customer responsibility.`
- `Laboratory result pending.`

If portal responsibility is assigned to the company:

- `Portal submission due July 25 — assigned to company.`

If responsibility is unassigned:

- `Portal submission due July 25 — responsibility not assigned.`
- `Administrative review required.`

If portal reporting becomes overdue:

- `Routine sample complete — next due August 20.`
- `Portal submission overdue — customer responsibility.`

When portal reporting is later completed:

- `Portal submission completed July 28.`
- `Completed late.`
- `Next routine sample remains due August 20.`

TowerTrack must never silently assume that cleaning, disinfection, hyperhalogenation, inspection, sampling, portal submission, laboratory results, or responsibility assignments substitute for one another.

Workflow text is operational guidance and not a treatment prescription.

A qualified person confirms treatment decisions, ambiguous qualification decisions, and manual overrides.
