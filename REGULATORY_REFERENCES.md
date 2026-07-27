# Regulatory references

These links are source material for configuration, not a legal opinion. Verify the active text and applicability before production use.

## New York City

- [NYC Cooling Tower Registration and Maintenance](https://www.nyc.gov/site/doh/business/permits-and-licenses/cooling-towers.page) summarizes the May 8, 2026 change, including a 31-day sampling maximum and 90-day inspections.
- [NYC Rules adoption record](https://rules.cityofnewyork.us/rule/amendment-of-rules-relating-to-reporting-requirements-for-cooling-towers/) identifies the adopted Chapter 8 amendment and May 8, 2026 effective date.
- Chapter 8/Table 8-1 is the configured source for NYC corrective thresholds. The MVP uses Level 4 at `>= 1,000 CFU/mL`; any differing summary wording must be resolved against the official current rule text by a qualified reviewer.

Implemented NYC configuration includes 31-day operating-period sampling, 90-day inspection, five-day sample/startup/shutdown portal follow-up, startup and hyperhalogenation windows, annual November 1 tracking, and corrective workflow. Exact responsibility assignment and treatment decisions remain review items.

## New York State

- [10 NYCRR Subpart 4-1](https://regs.health.ny.gov/content/subpart-4-1-cooling-towers) is the controlling state cooling-tower rule set.
- [NYSDOH Protection Against Legionella](https://www.health.ny.gov/environmental/water/drinking/legionella/) provides official program materials.
- [NYSDOH registry guide](https://www.health.ny.gov/environmental/water/drinking/legionella/cooling_tower_guide.htm) describes 30-day bacteriological sampling, 90-day Legionella sampling/reporting, 90-day inspection, and three-year onsite records.
- [Section 4-1.8](https://regs.health.ny.gov/content/section-4-18-inspection-and-certification) covers inspection and certification.

Implemented NYS-only configuration includes 90-day routine Legionella, 30-day bacteriological sampling, seasonal startup sampling, 90-day inspection, annual November 1 tracking, and idle/emergency triggers. Appendix 4-A response details beyond the shared scheduling workflow require qualified review.

## Policies, guidance, and pending rules

Out-of-state intervals in the seed are configurable Company Policy, not statutes. Guidance profiles use `GUIDANCE`; pending profiles use `PENDING_REGULATION` and produce review dates only. The fictional New Jersey monitoring example must be re-verified before any conversion. Custom profiles begin as Needs Review until an admin records a verified citation.
