# Testing

`npm run verify` runs everything CI runs except the browser suite (`npm run test:e2e`), which CI
runs straight after it.

## Where tests live

- **Next to the code they cover.** `budget.ts` is tested by `budget.test.ts`, `ChangeDialog.tsx` by
  `ChangeDialog.test.tsx`, and so on. Each test file covers one module or one feature.
- **Shared test helpers live in `tests/`**:
  - `fixtures.ts`: a fixed "today", sample profiles, plans and quotes.
  - `render.tsx`: rendering inside the real store, and axe checks.
  - `journeys.tsx`: demo plans, a stubbed AI service and opening a demo from home.
  - `aiResponses.ts`: canned AI service responses.
  - `server/`: requests, fake providers and handler wiring for the AI gateway.
- **Browser journeys** live in `tests/e2e/`.

## Layers

| Layer                  | Tooling                                               | What it proves                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Unit: core engines** | Vitest                                                | Budget maths and warnings, timeline ordering, compression, delay ripple, trade-off levers and ranking, vendor comparison, validation, change parsing (70+ phrasings), change conversion in both directions, diff, calendar export, schemas                                                                                                                         |
| **Property-based**     | fast-check                                            | Budget lines always sum exactly with nothing negative · more guests never cost less · higher tiers never cost less · every task is due on or before the event and after its dependencies · every trade-off lever saves money and never touches a protected category · the change parser never throws on arbitrary text · day arithmetic round-trips                |
| **Server / API**       | Vitest with injected fakes                            | Every guard (405, 403, 415, 413, 400, 429 + Retry-After, 422 injection), headers (`no-store`, `nosniff`, request id), caching keyed by prompt version, rules fallback, provider order, per-provider timeouts, circuit breaker, deadline, invalid, empty or unsafe model output, content-free error reasons, free-tier allowlist, request shapes for every provider |
| **Server type-check**  | `tsc -p tsconfig.server.json` (NodeNext)              | Every server import resolves the way Node ESM resolves it on Vercel                                                                                                                                                                                                                                                                                                |
| **Browser client**     | Vitest                                                | Response validation, error mapping, caching and de-duplication, graceful fallbacks, rules-first parsing, theme storage                                                                                                                                                                                                                                             |
| **State and hooks**    | Vitest + Testing Library                              | Undo/redo, history cap, one accepted quote per category, delay clamping, persistence round-trip, damaged or blocked storage, import validation, and `useAiAction` dropping answers that arrive after the plan changed                                                                                                                                              |
| **Components + flows** | Testing Library + user-event + axe-core               | A combined change (+50 guests, −10% budget, 2 weeks earlier) end to end, the intake wizard with focus management, the tabs keyboard pattern, trade-offs, what-if, assumptions, timeline, vendors, ideas (AI and offline), history, plan files, storage warnings. **axe reports 0 violations** on every screen and in the dialog                                    |
| **Contrast**           | Vitest reading `tokens.css`                           | WCAG AA ratios for every text/background pair in both themes                                                                                                                                                                                                                                                                                                       |
| **End to end**         | Playwright (desktop + Pixel 7) + @axe-core/playwright | The combined-change journey under the **production CSP** · reload persistence · keyboard-only intake · dark theme with axe (real contrast) · works with no AI service · no horizontal scroll at 320 px on every tab                                                                                                                                                |

## Gates (enforced, so they cannot drift)

- **Coverage** (`vitest.config.ts`):
  - `src/core/**`: at least 95% of lines, statements and functions, and 90% of branches.
  - `server/**`: at least 95% of lines, statements and functions, and 88% of branches.
  - Overall: at least 90% of lines, statements and functions, and 85% of branches.
- **Lint** (`eslint.config.js`):
  - Complexity at most 10 per function and nesting at most 3 levels deep.
  - At most 4 parameters, 80 lines per function and 250 lines per file.
  - Zero warnings.
- **Bundle size** (`scripts/check-bundle-size.mjs`): first-load JS, total JS and CSS budgets, plus
  no inline script or style.

## Slow machines

DOM tests allow up to 60 s per journey and wait up to 10 s for lazily loaded screens, so they stay
deterministic under coverage on slower laptops (`vitest.config.ts`, `tests/setup-dom.ts`).
