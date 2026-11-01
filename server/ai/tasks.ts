/**
 * The task registry: one entry per AI task, holding its prompt, output schema, sanitizer and the
 * deterministic fallback used when every provider fails. Adding a task means adding an entry here
 * and a case in `withTaskSpec`.
 */
import * as z from 'zod/mini';

import { changesFromAiOutput, changesToOutput } from '../../src/core/changes/aiChange.js';
import { parseChangeText } from '../../src/core/changes/parseChange.js';
import {
  IDEA_TEXT_FIELDS,
  IDEA_TEXT_LIMITS,
  LIMITS,
  VENDOR_QUESTION_LIMITS,
} from '../../src/core/constants/limits.js';
import {
  IdeasOutputSchema,
  ParseChangeOutputSchema,
  VendorQuestionsOutputSchema,
  type AiOutputByTask,
  type AiRequest,
  type AiTask,
  type ParseChangeOutput,
  type TaskRequest,
} from '../../src/core/contract.js';
import { generateFallbackIdeas } from '../../src/core/ideas.js';
import type { Idea } from '../../src/core/schemas.js';
import { fallbackVendorQuestions } from '../../src/core/vendors.js';
import { sanitizeModelText } from '../security/sanitize.js';
import {
  ideasPrompt,
  parseChangePrompt,
  PROMPT_VERSIONS,
  vendorQuestionsPrompt,
} from './prompts.js';

export type RequestFor<T extends AiTask> = TaskRequest<T>;

export interface TaskSpec<T extends AiTask> {
  /** Part of the cache key, so changing a prompt never serves answers to the old one. */
  promptVersion: string;
  maxOutputTokens: number;
  jsonSchema: Record<string, unknown>;
  outputSchema: z.ZodMiniType<AiOutputByTask[T]>;
  buildPrompt(request: RequestFor<T>): string;
  /** Free-text fields that are screened for prompt injection. */
  userText(request: RequestFor<T>): string[];
  /** Sanitizes validated output. Returns null when nothing usable is left. */
  postProcess(output: AiOutputByTask[T]): AiOutputByTask[T] | null;
  fallback(request: RequestFor<T>): AiOutputByTask[T];
}

/** JSON Schema for the model, without the $schema key that some providers reject. */
export function toModelJsonSchema(schema: z.ZodMiniType): Record<string, unknown> {
  const { $schema: _ignored, ...rest }: Record<string, unknown> = z.toJSONSchema(schema);
  return rest;
}

function sanitizeIdea(idea: Idea): Idea {
  const clean = { ...idea };
  for (const field of IDEA_TEXT_FIELDS) {
    clean[field] = sanitizeModelText(idea[field], IDEA_TEXT_LIMITS[field]);
  }
  return clean;
}

const ideas: TaskSpec<'ideas'> = {
  promptVersion: PROMPT_VERSIONS.ideas,
  maxOutputTokens: 1400,
  jsonSchema: toModelJsonSchema(IdeasOutputSchema),
  outputSchema: IdeasOutputSchema,
  buildPrompt: ideasPrompt,
  userText: (request) => [
    request.context.culture,
    ...request.context.mustHaves,
    request.refine?.instruction ?? '',
  ],
  postProcess(output) {
    const cleaned = output.ideas
      .map(sanitizeIdea)
      .filter((idea) => idea.title.length > 0 && idea.summary.length > 0);
    return cleaned.length > 0 ? { ideas: cleaned } : null;
  },
  fallback: (request) => ({
    ideas: generateFallbackIdeas(request.context, request.refine?.instruction),
  }),
};

const parseChange: TaskSpec<'parseChange'> = {
  promptVersion: PROMPT_VERSIONS.parseChange,
  maxOutputTokens: 300,
  jsonSchema: toModelJsonSchema(ParseChangeOutputSchema),
  outputSchema: ParseChangeOutputSchema,
  buildPrompt: parseChangePrompt,
  userText: (request) => [request.text],
  postProcess(output) {
    const { clarification, ...fields } = output;
    const cleaned = clarification ? sanitizeModelText(clarification, LIMITS.maxClarification) : '';
    const result: ParseChangeOutput = cleaned ? { ...fields, clarification: cleaned } : fields;
    const understood = changesFromAiOutput(result);
    return understood.changes.length > 0 || understood.clarifications.length > 0 ? result : null;
  },
  fallback(request) {
    const parsed = parseChangeText(request.text, request.context.today);
    return changesToOutput(parsed.changes, parsed.clarifications);
  },
};

/** Sanitized, de-duplicated questions; fragments shorter than a real question are dropped. */
function cleanQuestions(questions: readonly string[]): string[] {
  const seen = new Set<string>();
  return questions
    .map((question) => sanitizeModelText(question, VENDOR_QUESTION_LIMITS.maxLength))
    .filter((question) => {
      const key = question.toLowerCase();
      if (question.length < VENDOR_QUESTION_LIMITS.minLength || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

const vendorQuestions: TaskSpec<'vendorQuestions'> = {
  promptVersion: PROMPT_VERSIONS.vendorQuestions,
  maxOutputTokens: 500,
  jsonSchema: toModelJsonSchema(VendorQuestionsOutputSchema),
  outputSchema: VendorQuestionsOutputSchema,
  buildPrompt: vendorQuestionsPrompt,
  userText: () => [],
  postProcess(output) {
    const questions = cleanQuestions(output.questions);
    return questions.length > 0 ? { questions } : null;
  },
  fallback: (request) => ({ questions: fallbackVendorQuestions(request.category) }),
};

export const TASKS: { readonly [T in AiTask]: TaskSpec<T> } = {
  ideas,
  parseChange,
  vendorQuestions,
};

/** Runs `use` with a request and the spec for its task, keeping the two types paired without casts. */
export function withTaskSpec<R>(
  request: AiRequest,
  use: <T extends AiTask>(spec: TaskSpec<T>, request: RequestFor<T>) => R,
): R {
  switch (request.task) {
    case 'ideas':
      return use(TASKS.ideas, request);
    case 'parseChange':
      return use(TASKS.parseChange, request);
    case 'vendorQuestions':
      return use(TASKS.vendorQuestions, request);
  }
}
