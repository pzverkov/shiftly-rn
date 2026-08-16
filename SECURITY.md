# Security

This is a demo/portfolio project with no production deployment and no user data at
stake, but real vulnerability classes (business-logic bypass, injection, auth gaps) are
still worth reporting properly.

## Reporting a vulnerability

Please open a [GitHub Security Advisory](https://github.com/pzverkov/shiftly-rn/security/advisories/new)
rather than a public issue, so a fix can land before details are public. Include
reproduction steps and the affected component (`api/` or `app/`).

There's no bug bounty and no SLA - this is maintained on a best-effort basis - but
reports are read and taken seriously.

## Scope notes

- `api/`'s audit log (`api/src/audit/`) is tamper-evident, not a compliance control -
  see `api/README.md`'s Audit trail section for what it does and doesn't cover.
- Known, accepted dependency advisories are documented in `app/README.md`'s Checks
  section rather than hidden; check there before reporting a `npm audit` finding that's
  already tracked.
