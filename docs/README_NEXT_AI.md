# Next AI Handoff

Start here before editing the ITO system.

Primary plan:

- `docs/ito-cage-operations-master-plan.md`

Current active scope:

- Only work on YiDing ITO / Palace Operations.
- Do not change unrelated dashboard panels unless the ITO module depends on a shared bug fix.
- Keep the business model aligned to main cage, ITO cage, NN/CC chip flow, rolling target, credit, booking charges, reconciliation, audit and compliance.

Current implementation status:

- `Palace Operations` is inside `assets/js/home.js`.
- Palace proxy is in `vite.config.mjs` for dev and `api/palace/[[...path]].js` for production.
- Native deposit, withdraw, transfer, game start, credit, consumption, active sessions, settlement list/detail/export, settle, quick close, tip and mid-exchange are wired.
- Live QA for native `tip` and `mid-exchange` passed on `2026-06-03` using AGENT TEST account `00008`.
- Owned ITO domain scaffold now exists under `src/features/ito-operations`.
- Palace adapter scaffold now exists under `src/features/ito-operations/adapters`.
- Palace UI helper scaffold now exists under `src/features/ito-operations/ui`.
- Focused tests:
  - `tests/ito-domain.spec.js`
  - `tests/ito-palace-adapter.spec.js`
  - `tests/ito-palace-ui.spec.js`
  - `tests/ito-palace-operations.spec.js`

Latest verification:

- `npx playwright test tests/ito-domain.spec.js tests/ito-palace-adapter.spec.js tests/ito-palace-ui.spec.js tests/ito-palace-operations.spec.js` passed on 2026-06-03 with 19 tests.
- `npm run build` passed on 2026-06-03.
- `tests/ito-palace-operations.spec.js` uses a mocked Palace API, logs in through the YiDing Palace Operations panel, loads AGENT TEST session data, verifies native `mid-exchange`/`tip`, verifies Palace-shaped payloads for deposit, withdrawal, transfer, game start, credit borrow, credit repay and consumption, and verifies settlement detail, quick close, detailed settlement, credit void, consumption settle/void and export URL handling without mutating the live Palace system.
- `tests/ito-palace-ui.spec.js` verifies extracted Palace HTML helpers for escaping, currency options, customer options, active operation tabs, numeric table cells, operation-specific cage form fields, credit/consumption/session/settlement row action renderers, and settlement filter/pager controls.

Next best work:

1. Continue extracting Palace render/form sections gradually; do not do a single large rewrite.
2. Keep `assets/js/home.js` wrappers thin while moving pure Palace helpers into `src/features/ito-operations/ui`.
3. Keep adding tests around scaling, ledger balance and workflow invariants before deeper UI changes.
4. Start owned backend/data-model work only after UI adapter extraction is stable.

Safety rules:

- Use AGENT TEST only for live Palace mutation.
- Keep live mutation amounts tiny.
- Log every live mutation in the master plan.
- Do not scrape WhatsApp data without explicit authorized export/import path.
