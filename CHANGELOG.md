# Changelog

Notable changes to Shiftly, in reverse chronological order. Dates are the day the
change landed.

## 2026-08-16

- Rewrote the backend as NestJS (`api/`), replacing the earlier plain Express
  prototype: same six-endpoint contract, same business rules, same in-memory demo
  data, plus a `ShiftsRepository` DI-token abstraction (swappable backing store), a
  per-request shift-ownership check, and a tamper-evident hash-chained audit log
  recording every mutating request.
- New navy-and-gold "S" monogram app icon, replacing the earlier purple mark.
