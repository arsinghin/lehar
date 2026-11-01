/**
 * Converts between the parser's `Change` list and the flat shape the AI fills in.
 * Both directions live here so they cannot drift apart.
 */
import type { ParseChangeOutput } from '../contract.js';
import type { Change, ParsedChange } from './parseChange.js';

/** Shown when neither the rules nor the AI understood a change. */
export const CHANGE_HELP =
  'I could not work out the change. Try “50 more guests”, “budget is now 7 lakh” or “2 weeks earlier”.';

function assertNever(value: never): never {
  throw new Error(`Unhandled change: ${JSON.stringify(value)}`);
}

/** AI output → `Change` list. A "set" wins over a relative change of the same kind. */
export function changesFromAiOutput(output: ParseChangeOutput): ParsedChange {
  const changes: Change[] = [];
  if (output.guestsSet !== undefined) {
    changes.push({ kind: 'guests', mode: 'set', value: output.guestsSet });
  } else if (output.guestsDelta) {
    changes.push({ kind: 'guests', mode: 'delta', value: output.guestsDelta });
  }
  if (output.budgetSet !== undefined) {
    changes.push({ kind: 'budget', mode: 'set', value: output.budgetSet });
  } else if (output.budgetPercent) {
    changes.push({ kind: 'budget', mode: 'percent', value: output.budgetPercent });
  } else if (output.budgetDelta) {
    changes.push({ kind: 'budget', mode: 'delta', value: output.budgetDelta });
  }
  if (output.dateSet !== undefined) {
    changes.push({ kind: 'date', mode: 'set', date: output.dateSet });
  } else if (output.dateShiftDays) {
    changes.push({ kind: 'date', mode: 'shift', days: output.dateShiftDays });
  }
  const clarifications = output.clarification && changes.length === 0 ? [output.clarification] : [];
  return { changes, clarifications };
}

function writeChange(output: ParseChangeOutput, change: Change): void {
  switch (change.kind) {
    case 'guests':
      if (change.mode === 'set') output.guestsSet = change.value;
      else output.guestsDelta = change.value;
      return;
    case 'budget':
      if (change.mode === 'set') output.budgetSet = change.value;
      else if (change.mode === 'percent') output.budgetPercent = change.value;
      else output.budgetDelta = change.value;
      return;
    case 'date':
      if (change.mode === 'set') output.dateSet = change.date;
      else output.dateShiftDays = change.days;
      return;
    default:
      assertNever(change);
  }
}

/** `Change` list → AI output shape, used when the server answers with the rules instead of a model. */
export function changesToOutput(
  changes: readonly Change[],
  clarifications: readonly string[],
): ParseChangeOutput {
  const output: ParseChangeOutput = {};
  for (const change of changes) writeChange(output, change);
  if (changes.length === 0) output.clarification = clarifications[0] ?? CHANGE_HELP;
  return output;
}
