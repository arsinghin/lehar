# Accessibility (target: WCAG 2.2 AA)

## What is built in

- **Structure.** Landmarks (`header`, `main`, `footer`), a skip link, one `h1` per view, logical heading
  levels and `lang="en-IN"`.
- **Forms.** Every control has a visible `<label>`. Groups use `fieldset`/`legend`. Hints and errors are
  wired with `aria-describedby` and fields are marked `aria-invalid`. On a failed step, an **error summary
  receives focus** and links to each field.
- **Focus.** On each wizard step, focus moves to the step heading ("Step 2 of 5: Guests and budget"). The
  dialog is a native `<dialog>` (focus trap, Escape and focus restore from the browser), and focus is
  always visible as a 3 px ring.
- **Keyboard.** Everything works without a mouse. Tabs follow the WAI-ARIA pattern (Arrow keys, Home and
  End, roving tabindex). Scrollable tables are focusable named regions.
- **Announcements.** One polite live region announces every ripple ("Decoration style → Premium:
  +₹69,300…"). Buttons are marked `aria-busy` while waiting for AI.
- **Names.** Repeated actions have unique names that start with the visible text, e.g. "Accept Caterer A
  (sample)" and "Delay Book the venue" (WCAG 2.5.3 label in name). Links that open a new tab say so.
- **Not colour alone.** Status is always shown with text and an icon (Over budget, Overdue, Done). Deltas
  carry explicit +/− signs.
- **Contrast.** The token pairs in both themes are unit-tested from `tokens.css` (≥ 4.5:1 for text,
  ≥ 3:1 for focus and borders).
- **Reflow and motion.** Mobile-first, no horizontal scroll at 320 px (e2e tested on every tab), large
  tap targets (≥ 2.25 rem), and `prefers-reduced-motion` honoured.
- **Charts.** The budget bar is an SVG with an accessible name, and the same numbers are always given as
  text.

## How it is verified

- `axe-core` in component tests: 0 violations on every screen and the change dialog.
- `@axe-core/playwright` in a real browser with tags `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`, in
  light and dark themes, including colour contrast.
- A keyboard-only Playwright journey through the whole intake.

## Manual checklist before each release

- [ ] NVDA + Firefox: complete the intake, apply the change test, undo.
- [ ] VoiceOver on iOS: open a demo, mark a task done, add a quote.
- [ ] 400% zoom on desktop: no loss of content or function.
- [ ] Windows High Contrast: focus rings and badges remain visible.
