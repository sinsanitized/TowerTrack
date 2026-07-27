# Repository guidance

- Preserve date-only compliance values; never convert them through local browser time.
- Add rule constants to versioned rule definitions or `lib/rules.ts`, never UI components.
- NYC logic must never be the global default.
- Planned activity does not reset a compliance clock.
- Cleaning and sampling remain separate activities.
- Every new write path requires server-side authorization and an audit record.
- Use plain-English status plus color/icon; never color alone.
- Run format, typecheck, unit tests, and build after changes. Run Playwright for workflow changes.
