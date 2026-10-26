/** Converts the AI's flat change output into the same `Change` list the deterministic parser produces. */
import type { ParseChangeOutput } from '../contract.js';
import type { Change, ParsedChange } from './parseChange.js';

export function changesFromAiOutput(output: ParseChangeOutput): ParsedChange {
  const changes: Change[] = [];
  if (output.guestsSet !== undefined)
    changes.push({ kind: 'guests', mode: 'set', value: output.guestsSet });
  else if (output.guestsDelta !== undefined && output.guestsDelta !== 0) {
    changes.push({ kind: 'guests', mode: 'delta', value: output.guestsDelta });
  }
  if (output.budgetSet !== undefined)
    changes.push({ kind: 'budget', mode: 'set', value: output.budgetSet });
  else if (output.budgetPercent !== undefined && output.budgetPercent !== 0) {
    changes.push({ kind: 'budget', mode: 'percent', value: output.budgetPercent });
  } else if (output.budgetDelta !== undefined && output.budgetDelta !== 0) {
    changes.push({ kind: 'budget', mode: 'delta', value: output.budgetDelta });
  }
  if (output.dateSet !== undefined)
    changes.push({ kind: 'date', mode: 'set', date: output.dateSet });
  else if (output.dateShiftDays !== undefined && output.dateShiftDays !== 0) {
    changes.push({ kind: 'date', mode: 'shift', days: output.dateShiftDays });
  }
  const clarifications = output.clarification && changes.length === 0 ? [output.clarification] : [];
  return { changes, clarifications };
}
