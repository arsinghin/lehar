/**
 * The task registry: one entry per AI task, holding its prompt, output schema, sanitiser and the
 * deterministic fallback used when every provider fails. Adding a task means adding an entry here.
 */
import * as z from 'zod/mini';

import { changesFromAiOutput } from '../../src/core/changes/aiChange.js';
import { parseChangeText, type Change } from '../../src/core/changes/parseChange.js';
import { VENDOR_PROFILES } from '../../src/core/constants/vendors.js';
import {
  IdeasOutputSchema,
  ParseChangeOutputSchema,
  VendorQuestionsOutputSchema,
  type AiOutputByTask,
  type AiRequest,
  type AiTask,
  type IdeasRequest,
  type ParseChangeOutput,
  type ParseChangeRequest,
  type VendorQuestionsRequest,
} from '../../src/core/contract.js';
import { generateFallbackIdeas } from '../../src/core/ideas.js';
import { sanitizeModelText } from '../security/sanitize.js';
import {
  ideasPrompt,
  parseChangePrompt,
  PROMPT_VERSIONS,
  vendorQuestionsPrompt,
} from './prompts.js';

type RequestFor<T extends AiTask> = Extract<AiRequest, { task: T }>;

export interface TaskSpec<T extends AiTask> {
  promptVersion: string;
  maxOutputTokens: number;
  jsonSchema: Record<string, unknown>;
  outputSchema: z.ZodMiniType<AiOutputByTask[T]>;
  buildPrompt(request: RequestFor<T>): string;
  /** Free-text fields that are screened for prompt injection. */
  userText(request: RequestFor<T>): string[];
  /** Sanitises validated output. Returns null when nothing usable is left. */
  postProcess(output: AiOutputByTask[T]): AiOutputByTask[T] | null;
  fallback(request: RequestFor<T>): AiOutputByTask[T];
}

/** JSON Schema for the model, without the $schema key that some providers reject. */
export function toModelJsonSchema(schema: z.ZodMiniType): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}

const ideas: TaskSpec<'ideas'> = {
  promptVersion: PROMPT_VERSIONS.ideas,
  maxOutputTokens: 1400,
  jsonSchema: toModelJsonSchema(IdeasOutputSchema),
  outputSchema: IdeasOutputSchema,
  buildPrompt: ideasPrompt,
  userText: (request: IdeasRequest) => [
    request.context.culture,
    ...request.context.mustHaves,
    request.refine?.instruction ?? '',
  ],
  postProcess(output) {
    const cleaned = output.ideas
      .map((idea) => ({
        ...idea,
        title: sanitizeModelText(idea.title, 70),
        summary: sanitizeModelText(idea.summary, 260),
        decor: sanitizeModelText(idea.decor, 200),
        food: sanitizeModelText(idea.food, 200),
        activity: sanitizeModelText(idea.activity, 200),
        whyItFits: sanitizeModelText(idea.whyItFits, 240),
      }))
      .filter((idea) => idea.title.length > 0 && idea.summary.length > 0);
    return cleaned.length > 0 ? { ideas: cleaned } : null;
  },
  fallback: (request) => ({
    ideas: generateFallbackIdeas(request.context, request.refine?.instruction),
  }),
};

const CHANGE_HELP =
  'I could not work out the change. Try “50 more guests”, “budget is now 7 lakh” or “2 weeks earlier”.';

/** Converts deterministic parser output into the flat AI output shape. */
export function changesToOutput(
  changes: readonly Change[],
  clarifications: readonly string[],
): ParseChangeOutput {
  const output: ParseChangeOutput = {};
  for (const change of changes) {
    if (change.kind === 'guests') {
      if (change.mode === 'set') output.guestsSet = change.value;
      else output.guestsDelta = change.value;
    } else if (change.kind === 'budget') {
      if (change.mode === 'set') output.budgetSet = change.value;
      else if (change.mode === 'percent') output.budgetPercent = change.value;
      else output.budgetDelta = change.value;
    } else if (change.mode === 'set') output.dateSet = change.date;
    else output.dateShiftDays = change.days;
  }
  if (changes.length === 0) output.clarification = clarifications[0] ?? CHANGE_HELP;
  return output;
}

const parseChange: TaskSpec<'parseChange'> = {
  promptVersion: PROMPT_VERSIONS.parseChange,
  maxOutputTokens: 300,
  jsonSchema: toModelJsonSchema(ParseChangeOutputSchema),
  outputSchema: ParseChangeOutputSchema,
  buildPrompt: parseChangePrompt,
  userText: (request: ParseChangeRequest) => [request.text],
  postProcess(output) {
    const clarification = output.clarification
      ? sanitizeModelText(output.clarification, 200)
      : undefined;
    const result: ParseChangeOutput = { ...output };
    if (clarification) result.clarification = clarification;
    else delete result.clarification;
    const understood = changesFromAiOutput(result);
    return understood.changes.length > 0 || understood.clarifications.length > 0 ? result : null;
  },
  fallback(request) {
    const parsed = parseChangeText(request.text, request.context.today);
    return changesToOutput(parsed.changes, parsed.clarifications);
  },
};

const GENERIC_QUESTIONS = [
  'What exactly is included in the price, and what costs extra?',
  'What advance is needed, and what is the cancellation policy?',
  'What do you need from us, and by when?',
];

const vendorQuestions: TaskSpec<'vendorQuestions'> = {
  promptVersion: PROMPT_VERSIONS.vendorQuestions,
  maxOutputTokens: 500,
  jsonSchema: toModelJsonSchema(VendorQuestionsOutputSchema),
  outputSchema: VendorQuestionsOutputSchema,
  buildPrompt: vendorQuestionsPrompt,
  userText: () => [],
  postProcess(output) {
    const seen = new Set<string>();
    const questions = output.questions
      .map((question) => sanitizeModelText(question, 200))
      .filter((question) => {
        const key = question.toLowerCase();
        if (question.length < 10 || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return questions.length > 0 ? { questions } : null;
  },
  fallback: (request: VendorQuestionsRequest) => ({
    questions: [...(VENDOR_PROFILES[request.category]?.questions ?? GENERIC_QUESTIONS)].slice(0, 5),
  }),
};

export const TASKS: { [T in AiTask]: TaskSpec<T> } = { ideas, parseChange, vendorQuestions };
