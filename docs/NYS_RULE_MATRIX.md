# TowerTrack New York rule matrix

Reviewed July 30, 2026. Dates in the engine are authoritative `YYYY-MM-DD`
values. An “immediate” requirement is not converted into an invented multi-day
deadline.

## New York State outside NYC — 10 NYCRR Subpart 4-1

| Obligation                               | Trigger / frequency                                                                      | Completion record                     | Hard timing                                                   | Operating state       | Separate reporting                                  | Records / authority               | Confidence                                                                                    |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------- | --------------------- | --------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| Registration                             | Initial operation or ownership change                                                    | Registry confirmation                 | Before operation / change                                     | Initial startup       | Yes                                                 | 10 NYCRR §4-1.3(a)                | Verified; TowerTrack does not invent an initial date when the registration history is missing |
| Maintenance Program and Plan             | Before initial startup; update as needed                                                 | MPP version / qualified-person review | Before initial startup                                        | All states            | No                                                  | 10 NYCRR §4-1.4(a); retain onsite | Verified; missing original startup requires review                                            |
| Bacteriological culture                  | Last collection                                                                          | Bacteriological sample collected      | No more than 30 days while in use                             | Operating             | Registry data at intervals no greater than 90 days  | 10 NYCRR §§4-1.4(b)(1), 4-1.3     | Verified                                                                                      |
| Legionella culture                       | Last collection                                                                          | Legionella sample collected           | No more than 90 days while in use                             | Operating             | Registry data at intervals no greater than 90 days  | 10 NYCRR §§4-1.4(b)(2), 4-1.3     | Verified                                                                                      |
| Seasonal startup Legionella culture      | Startup                                                                                  | Legionella sample collected           | Within 14 days after startup                                  | Startup / operating   | Startup and sampling data reported                  | 10 NYCRR §§4-1.4(b)(2), 4-1.3     | Verified                                                                                      |
| Inspection                               | Last qualified-person inspection; seasonal startup                                       | Inspection completed                  | Before seasonal startup and no more than 90 days while in use | Operating / startup   | Inspection reported                                 | 10 NYCRR §§4-1.8(a), 4-1.3        | Verified                                                                                      |
| Annual certification                     | Calendar year                                                                            | Certification submitted               | November 1                                                    | All registered towers | Yes, separately tracked                             | 10 NYCRR §4-1.8(b)                | Verified                                                                                      |
| Emergency Legionella sampling            | Power failure, biocide loss, conductivity failure, DOH direction, or other MPP condition | Legionella sample collected           | Immediate; no fabricated end date                             | As applicable         | Result/remediation reporting applies                | 10 NYCRR §4-1.4(b)(3)             | Verified                                                                                      |
| Result 20–999 CFU/mL                     | Result received                                                                          | Online disinfection plus retest       | Immediate disinfection; retest 3–7 days                       | As applicable         | Report sample/result/remediation                    | Appendix 4-A                      | Verified                                                                                      |
| Result at least 1,000 CFU/mL             | Result received                                                                          | Online decontamination plus retest    | Immediate decontamination; retest 3–7 days                    | As applicable         | Report; LHD notice when result exceeds 1,000 CFU/mL | Appendix 4-A; 10 NYCRR §4-1.6     | Verified; repeat result controls full system decontamination                                  |
| Cleaning before startup after stagnation | More than five days without circulation                                                  | Cleaning/disinfection event           | Before startup                                                | Startup               | Report when required by registry fields             | 10 NYCRR §4-1.4(c)(2)             | Verified rule; needs an authoritative stagnation duration before TowerTrack can calculate it  |
| Recordkeeping                            | Sampling, analysis, disinfection, inspections, corrections, certifications               | Retained source records               | At least three years                                          | All states            | N/A                                                 | 10 NYCRR §4-1.9                   | Verified; source-document retention is outside the event calculator                           |

NYS-only profiles do not include the NYC summertime hyperhalogenation event or
declaration.

## New York City — existing Chapter 8 profile

| Obligation                     | Existing TowerTrack behavior                                                               | Source                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------- |
| Routine Legionella sampling    | Existing 31-day maximum and configured operational target                                  | NYC Chapter 8 §8-05                          |
| Sample-date portal entry       | Five days after collection                                                                 | NYC Chapter 8 §8-05                          |
| Qualified-person inspection    | Existing 90-day clock                                                                      | NYC Chapter 8 and applicable 10 NYCRR §4-1.8 |
| Startup                        | Cleaning/disinfection in the preceding 15 days; Legionella sample day 3–14; startup notice | 24 RCNY §8-06                                |
| Summertime hyperhalogenation   | July 1–August 31; post-event sample and declaration remain NYC-only                        | 24 RCNY §8-04(f)                             |
| Corrective actions and retests | Existing Chapter 8 levels and timelines are unchanged                                      | NYC Chapter 8                                |
| Annual cleaning                | Existing twice-per-calendar-year behavior is unchanged                                     | 24 RCNY §8-04                                |

## Custom / Out of State

New profiles start with no enabled obligation. Administrators may add explicitly
labeled company, customer, contract, guidance, or review rules. TowerTrack
rejects `REGULATORY` as the authority for a generic custom profile. Local legal
requirements still require qualified review.
