# Changelog

All notable changes to Lehar. Dates are in IST.

## 1.1.0 – 2026-11-01

### Changed

- The code is restructured for maintainability, with no change to what the host sees:
  - One source of truth for limits, validation, change conversion and fallbacks, shared by the
    browser and the server.
  - Screens are split into small components with named props.
  - The reducer, the request handler and the change parser are built from small, typed steps.
  - No type casts remain in production code.
- Lint now enforces limits on complexity, nesting, parameters, function length and file length.
- Tests now sit next to the modules they cover. Shared helpers are in `tests/`.
- CI runs `npm run verify`, the same command contributors run, and reads the Node version from
  `.nvmrc`.

### Fixed

- An AI answer that arrives after the plan has changed is dropped instead of overwriting newer data.
- A "Something changed?" preview can no longer be applied to text other than the text it was made from.
- Loading a plan file that cannot be read now shows a message instead of failing silently.
- The prompt version is part of the server cache key, so a prompt change takes effect immediately.
- Offline vendor questions for categories without a checklist now show the generic questions, matching
  the server.
- Server logs no longer include upstream error text, and unexpected errors are logged at error level.

## 1.0.0 – 2026-10-26

- First release: guided intake, budget with trade-offs, dependency-aware timeline, vendor
  coordination, personalised ideas, "Something changed?" with a ripple preview, undo and version
  history.
- AI from Google Gemini, with free OpenRouter and NVIDIA NIM fallbacks and built-in rules.
