# Assumptions and limits

- TowerTrack is an internal operational scheduling, compliance-tracking, and workflow-support application. It is not legal advice, does not replace professional judgment, and does not independently determine legal responsibility.

- TowerTrack may identify deadlines, required follow-up, scheduling conflicts, missing records, and potentially unsatisfied obligations based on configured compliance profiles. Final compliance decisions remain subject to review by a qualified person, administrator, consultant, regulator, or legal counsel as appropriate.

- Task ownership, assigned personnel, service responsibility, customer responsibility, third-party responsibility, and follow-up responsibility are operational labels. They help coordinate work but do not establish contractual, statutory, or regulatory liability.

- The complete owner-versus-contractor responsibility matrix remains outside the current scope. TowerTrack may record who is expected to perform, approve, document, submit, confirm, or follow up on an activity without determining who is legally responsible for the underlying obligation.

- The optimized workflow is centered on NYC cooling-tower operations under the configured Chapter 8 compliance profile. New York systems outside NYC use the verified `NYS_PART_4_ONLY` profile. Other jurisdictions and generic Company Policy profiles may contain scheduling structures and common operational events but may not provide the same depth of regulatory automation.

- Out-of-state, customer-specific, and generic requirements default to Company Policy unless an administrator configures and verifies a jurisdiction-specific compliance profile.

- Pending, proposed, draft, guidance-only, monitoring, or otherwise unverified requirements may be stored for review and planning. They do not create hard compliance deadlines, overdue findings, or mandatory work until an authorized administrator activates them within a verified profile.

- TowerTrack generates obligations from recorded operational events, configured rules, qualifying conditions, linked records, responsibility assignments, and reporting events. Generated dates are planning and compliance-support outputs and must remain traceable to the event and rule that created them.

- Compliance dates may change when events are completed, corrected, canceled, superseded, linked, voided, or determined not to qualify. The application must preserve the history of these changes and explain why an obligation was created, moved, satisfied, reopened, or removed.

- An authoritative event satisfies, closes, or resets an obligation only when it is completed or confirmed and meets the configured qualifying conditions. Creating, scheduling, assigning, or starting work does not by itself satisfy an obligation.

- Portal submissions, laboratory results, operating-state changes, certifications, notifications, responsibility assignments, and other non-service facts must be recorded through their appropriate event types. They must not be inferred from generic service-event completion.

- A routine Legionella sampling clock resets when the sample collection activity is completed, the actual collection date is recorded, the sample explicitly qualifies for the routine requirement, and it is linked to the correct system and obligation.

- For NYC systems, TowerTrack advances the routine Legionella clock immediately when a completed sample qualifies for the routine sampling requirement.

- The next NYC routine due date is calculated from the qualifying sample collection date plus 31 calendar days.

- Portal submission or portal confirmation is not required before TowerTrack calculates or displays the next NYC routine sampling due date.

- The portal-submission date, portal-confirmation date, laboratory-receipt date, result date, review date, result-upload date, and portal result-entry date do not replace the sample collection date when calculating the routine sampling interval.

- A completed qualifying NYC sample may fully satisfy the routine sampling obligation while its related portal-reporting obligation remains open, late, externally assigned, or unassigned.

- Portal reporting is a separate operational obligation and must not block or delay:

  - routine-date calculation;
  - laboratory-result entry;
  - corrective-action generation;
  - route creation;
  - visit completion;
  - future sampling;
  - startup or shutdown workflow;
  - inspection, cleaning, disinfection, treatment, or certification work.

- Portal-reporting responsibility may be assigned operationally to the company, customer, another third party, or administrative review.

- A portal responsibility assignment indicates who is expected to perform or confirm the submission. It does not determine legal, contractual, statutory, or regulatory responsibility.

- When portal reporting is assigned to the customer or another third party, TowerTrack may track the item as external follow-up without placing it in the technician’s required field-service queue.

- Missing customer or third-party portal confirmation does not stop the company’s operational workflow.

- When portal responsibility is unassigned, TowerTrack may create an administrative review item without blocking any other obligation or workflow.

- `NOT_APPLICABLE` may be used only when portal reporting is genuinely not required under the active verified profile or sample type. It must not be used merely because portal submission is not the company’s responsibility.

- Correcting, completing, reassigning, or voiding only the portal-reporting record does not change the routine sampling clock or the next routine due date.

- The routine sampling clock changes only when the underlying qualifying sample is corrected, voided, canceled, linked to the wrong system, determined not to qualify, or otherwise invalidated.

- Sampling events, portal-reporting events, and laboratory results are separate but linked records.

- A laboratory result must be associated with the correct sample, cooling-tower system, collection date, laboratory record, and applicable obligation before it can affect corrective-action workflow.

- Missing or incomplete portal reporting does not prevent a laboratory result from creating corrective actions.

- A corrective-action event does not automatically satisfy routine cleaning, disinfection, treatment, inspection, sampling, certification, or reporting requirements unless the active verified profile explicitly permits that event to satisfy the separate obligation.

- Cleaning, disinfection, hyperhalogenation, routine treatment, sampling, startup, shutdown, idle status, inspections, corrective actions, certifications, portal submissions, portal confirmations, responsibility assignments, and laboratory results are distinct event types.

- Distinct activities may be coordinated, linked, or completed during the same visit, but one activity must not be treated as another without an explicit qualifying rule.

- TowerTrack may recommend combining eligible work during the same visit when independently existing obligation windows overlap, such as combining a routine sample with an inspection, startup sample, corrective retest, emergency sample, or hyperhalogenation follow-up when the configured rules permit it.

- Cleaning or disinfection does not create a routine Legionella sample window unless an active verified rule explicitly provides one.

- Combined scheduling does not merge the underlying obligations, remove their individual documentation requirements, or automatically allow one activity to satisfy another.

- A special-purpose Legionella sample does not automatically satisfy the routine sampling obligation.

- Startup, corrective, emergency, DOH-directed, hyperhalogenation-follow-up, and biological-indicator-triggered samples may satisfy the routine clock only when the active verified profile permits dual qualification and the sample is explicitly linked to both obligations.

- Portal reporting does not determine whether a sample qualifies for dual use. Portal reporting remains a separate follow-up obligation.

- Overlapping obligations should be coordinated when possible, but TowerTrack must preserve each obligation’s original source, authority, deadline, qualifying criteria, responsibility assignment, satisfaction status, linked evidence, and closure reason.

- Date windows are based on configured calendar-day, business-day, or hour-based rules.

- Working-day calculations use the versioned company calendar: Monday through Friday excluding observed U.S. federal holidays, except Veterans Day remains a working day and the Friday after Thanksgiving is a company holiday.

- Weekends, holidays, building access restrictions, laboratory schedules, customer operating conditions, and technician availability may affect practical scheduling without automatically changing a regulatory deadline.

- Date-only values are authoritative for calendar-based compliance calculations.

- Rules measured in hours—including 24-hour notification, 24-hour disinfection, 48-hour remediation, and 48-hour retesting—use timezone-aware timestamps.

- `America/New_York` is the default operational and display timezone for NYC and New York profiles.

- Relative labels such as `today`, `tomorrow`, `in 3 business days`, and `overdue by 2 days` are display aids. The underlying absolute date or timestamp remains authoritative.

- Routine sampling status, portal-reporting status, laboratory status, corrective status, and responsibility-review status must be evaluated and displayed separately.

- A completed routine sample may display as green while:

  - portal reporting remains blue;
  - portal reporting is red because it is overdue;
  - laboratory results remain blue;
  - corrective work is red;
  - responsibility assignment is purple.

- An overdue portal-reporting obligation must not make a completed routine sampling obligation appear overdue or incomplete.

- A completed routine sample must not make an open portal-reporting obligation appear complete.

- A customer-assigned or third-party-assigned portal obligation must not appear as technician-required work unless a separate company follow-up task has been created.

- The most urgent open obligation may affect sorting or attention, but TowerTrack must not collapse independent obligations into one misleading overall status.

- Manual route zones and operational groupings are authoritative for MVP scheduling and dispatch.

- Stored addresses and coordinates support future route optimization but do not override manually assigned zones unless an administrator activates and approves automated routing.

- Missing, late, externally assigned, or unassigned portal reporting does not prevent route creation or future routine scheduling.

- Correcting an event must not silently rewrite compliance history.

- TowerTrack must retain the original record, correction details, affected obligations, recalculation results, the user responsible for the change, the reason for the correction, and any resulting downstream changes.

- Deleted or canceled work must not satisfy an obligation.

- Completed compliance records are corrected or voided rather than hard-deleted.

- When a previously qualifying sample event is reversed, corrected, voided, or determined invalid, affected routine and downstream obligations may be reopened or recalculated.

- Correcting or voiding only a portal-reporting event affects portal status, timeliness, assignment, and audit history. It does not reopen the routine sampling obligation.

- Reassigning portal responsibility must be audited but must not change any sampling date.

- TowerTrack may flag missing documentation, incomplete workflows, unusual sequencing, impossible overlaps, inconsistent records, conflicting dates, missing reporting confirmation, missing responsibility assignment, or unclear qualification.

- A warning indicates the need for review and does not necessarily establish a regulatory violation.

- A green, yellow, red, blue, gray, or purple status is an operational communication aid. It is not, by itself, a legal conclusion.

- Scheduled work does not satisfy an obligation, advance a compliance clock, or convert an overdue obligation into a compliant one.

- A completed qualifying sample does advance the applicable routine sampling clock even when portal reporting or laboratory follow-up remains open.

- Demo, test, seeded, and training data are fictional or clearly identified as non-production records.

- Non-production records must not create real operational obligations, compliance conclusions, customer reporting, or regulatory submissions.

- The application currently supports operational tracking for recurring sampling, cleaning and disinfection, corrective actions, startup, shutdown, idle periods, inspections, certifications, portal-related work, responsibility-aware follow-up, laboratory-result chains, visit completion, documentation, corrections, and related date generation.

- The application does not currently perform automated regulatory portal submission, laboratory-system integration, OCR verification, advanced route optimization, customer self-service, complete state-by-state regulatory interpretation, automated legal-responsibility determination, treatment-system automation, or guaranteed audit-ready binder generation unless those features are separately implemented and verified.

- Regulatory wording, thresholds, response requirements, qualifying-event rules, reporting conditions, dual-qualification rules, shutdown definitions, and responsibility questions must be reviewed before production reliance.

- Configured rules should identify their source, jurisdiction, authority type, effective date, profile version, verification status, and administrator approval.

- Company Policy, Guidance, Pending Regulation, Manual Review, and Regulatory obligations must be visibly distinguished and must not be presented as equivalent authorities.

- Operational responsibility labels such as Company, Customer, Third Party, and Unassigned must remain distinct from authority labels such as Regulatory or Company Policy.

- Any seeded pending-regulation item, including a New Jersey example, is a workflow demonstration or monitoring record unless explicitly marked as verified and active.

- The presence of a pending or monitoring item is not a statement of current law.
