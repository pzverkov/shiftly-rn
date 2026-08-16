# Contributing

## Running locally

```bash
# API
cd api && npm install && npm start   # http://localhost:3000

# Mobile client
cd app && npm install && npx expo start
```

See [api/README.md](api/README.md) and [app/README.md](app/README.md) for details.

## Before opening a PR

Both projects must pass their own checks:

```bash
cd api && npm run lint && npm run typecheck && npm run build && npm test
cd app && npm run lint && npm run typecheck && npm test
```

CI runs the same checks on every PR (`.github/workflows/ci.yml`).

## Conventions

- Commit messages: lowercase imperative, no type prefix (`add X`, `fix Y`, not
  `feat: X` or `Fix: Y`).
- Keep `api/` and `app/` independent - no shared workspace tooling. The contract
  between them is pinned by `app/src/domain/shift.contract.test.ts`, which imports
  `api/`'s real rules module directly; don't let that drift.
- No new dependency without a reason - check the standard library and what's already
  in `package.json` first.
