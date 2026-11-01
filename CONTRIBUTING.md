# Contributing to Lehar

Thank you for helping. Lehar is maintained by AR Singh ([@arsinghin](https://github.com/arsinghin)).
Please open an issue to discuss larger changes before starting work.

## Set up

```bash
npm ci
npm run dev        # the app only; AI features use built-in suggestions
npx vercel dev     # the app and /api, reading keys from .env.local (see .env.example)
```

## Before you open a pull request

```bash
npm run verify     # types, lint, format, tests with coverage gates, secret scan, build, size budget
npm run test:e2e   # Playwright on desktop and mobile
```

Both must pass. CI runs the same commands.

## How the code is organised

- **Numbers and dates belong in `src/core`.** Budgets, schedules, trade-offs and validation are pure
  functions with no React or DOM imports (lint-enforced). The AI never produces a number the host relies
  on.
- **One rule, one place.** Before adding a limit, a message or a fallback, check `src/core/constants`
  and `src/core/validation.ts`. The browser and the server share them.
- **Screens are small.** One folder per screen in `src/features`, split into components with named
  `…Props` interfaces. State changes go through the `actions` creators in `src/state/store.ts`; AI calls
  go through `useAiAction`.
- **Limits are enforced by lint:**
  - complexity at most 10 per function, and nesting at most 3 levels deep;
  - at most 4 parameters, 80 lines per function and 250 lines per file.

  If a limit is hit, split the code; don't disable the rule.

- **No casts or `any` in production code.** Use the typed helpers (`withTaskSpec`, `SelectField`,
  `toPriority`) or a zod schema instead.

## Tests

- Put the test next to the code: `thing.ts` → `thing.test.ts`. Shared fixtures live in `tests/`.
- Add a test with every change, including a regression test for every bug fix.
- Test behaviour through the UI the way a host would use it (roles and labels, not CSS selectors), and
  keep `axeViolations` at zero for new screens.

## Prompts

When you change a prompt in `server/ai/prompts.ts`, bump its version in `PROMPT_VERSIONS` and add a row
to [`docs/PROMPTS.md`](docs/PROMPTS.md). Never ask a model for prices, vendor names or dates.

## Style

- Prettier formats everything (`npm run format`).
- Code, comments and test names use American spelling (`sanitize`, `normalize`). Text the host sees
  uses Indian English (`colour`, `organising`).
- Keep commit messages short and in the imperative ("Add …", "Fix …"), with the reason in the body.

## Security

Please report vulnerabilities privately as described in [`SECURITY.md`](SECURITY.md).

## Licence

By contributing, you agree that your contributions are licensed under the
[Apache License 2.0](LICENSE).
