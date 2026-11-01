/** Saving the open plan to a file and loading one back, with validation and friendly errors. */
import type { PlanState } from '../../core/schemas';
import { downloadText, slugify } from '../../lib/util';
import { parsePlanFile } from '../../state/persistence';

/** Longest file name kept in the history entry for a loaded plan. */
const MAX_FILE_NAME_IN_HISTORY = 60;

/** Downloads the plan as "<title>.lehar.json". */
export function savePlanFile(plan: PlanState, title: string): void {
  downloadText(`${slugify(title)}.lehar.json`, JSON.stringify(plan, null, 2), 'application/json');
}

export type LoadedPlanFile =
  { ok: true; plan: PlanState; reason: string } | { ok: false; message: string };

/** Reads and validates a chosen file. Never throws: every failure becomes a message for the host. */
export async function loadPlanFile(file: File): Promise<LoadedPlanFile> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, message: 'That file could not be read. Please try again.' };
  }
  const result = parsePlanFile(text);
  if (!result.ok) return result;
  const name = file.name.slice(0, MAX_FILE_NAME_IN_HISTORY);
  return { ok: true, plan: result.plan, reason: `Loaded plan from ${name}` };
}
