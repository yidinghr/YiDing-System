# ITO Operations Domain

This folder is the owned YiDing ITO model. It must stay focused on the casino ITO workflow:

- main cage
- ITO cage
- account/household
- cash deposit
- NN/CC chip flow
- rolling target
- game session
- mid-exchange
- tip
- settlement
- credit/marker
- booking/consumption
- reconciliation
- audit

The current Palace integration remains a reference/adapter inside `assets/js/home.js` and `/api/palace`. The code here is where the future YiDing-owned system should grow.

Rules:

- Do not import dashboard panel code into domain files.
- Keep domain files pure and testable.
- Keep Palace-specific quirks, such as `0.01 -> 100` amount scaling, isolated behind explicit adapter helpers.
- Financial operations should be represented by balanced ledger entries.
- Workflow actions should be checked with the state-machine helpers before UI/API mutation.

