/**
 * High-level AI actions used by the screens. Each one degrades gracefully: when the API is unavailable,
 * it uses the same deterministic rules as the server, so the host is never stuck.
 */
import { toIdeaContext, toParseChangeRequest, toVendorQuestionsRequest } from '../core/aiContext';
import { changesFromAiOutput } from '../core/changes/aiChange';
import { parseChangeText, type ParsedChange } from '../core/changes/parseChange';
import type { AiSource, Category } from '../core/constants/enums';
import { VENDOR_PROFILES } from '../core/constants/vendors';
import { generateFallbackIdeas } from '../core/ideas';
import type { EventProfile, IdeaSet, VendorQuestionSet } from '../core/schemas';
import { AiClientError, requestAi } from './apiClient';

export interface AiOutcome<T> {
  value: T;
  /** Shown to the host when something notable happened (e.g. built-in suggestions were used). */
  notice: string | null;
}

export const OFFLINE_NOTICE =
  'AI suggestions are unavailable right now, so Lehar used its built-in suggestions.';

function noticeFor(error: unknown): { fallback: boolean; notice: string } {
  if (error instanceof AiClientError) {
    if (error.code === 'rate_limited') {
      const wait = error.retryAfterSeconds
        ? ` Try again in about ${error.retryAfterSeconds} seconds.`
        : '';
      return {
        fallback: true,
        notice: `You have asked for a lot of suggestions in a short time.${wait} Showing built-in suggestions for now.`,
      };
    }
    if (error.code === 'input_rejected' || error.code === 'invalid_request') {
      return { fallback: false, notice: error.message };
    }
  }
  return { fallback: true, notice: OFFLINE_NOTICE };
}

export class AiInputError extends Error {
  override name = 'AiInputError';
}

export async function fetchIdeas(
  profile: EventProfile,
  refine?: { ideaTitle: string; instruction: string },
): Promise<AiOutcome<IdeaSet>> {
  const context = toIdeaContext(profile);
  try {
    const result = await requestAi({ task: 'ideas', context, ...(refine ? { refine } : {}) });
    return {
      value: {
        items: result.data.ideas,
        source: result.source,
        ...(refine ? { refinedWith: refine.instruction } : {}),
      },
      notice: result.source === 'rules' ? OFFLINE_NOTICE : null,
    };
  } catch (error) {
    const { fallback, notice } = noticeFor(error);
    if (!fallback) throw new AiInputError(notice);
    return {
      value: {
        items: generateFallbackIdeas(context, refine?.instruction),
        source: 'rules',
        ...(refine ? { refinedWith: refine.instruction } : {}),
      },
      notice,
    };
  }
}

export async function fetchVendorQuestions(
  profile: EventProfile,
  category: Category,
): Promise<AiOutcome<VendorQuestionSet>> {
  try {
    const result = await requestAi(toVendorQuestionsRequest(profile, category));
    return {
      value: { questions: result.data.questions, source: result.source },
      notice: result.source === 'rules' ? OFFLINE_NOTICE : null,
    };
  } catch (error) {
    const { fallback, notice } = noticeFor(error);
    if (!fallback) throw new AiInputError(notice);
    return {
      value: { questions: [...(VENDOR_PROFILES[category]?.questions ?? [])], source: 'rules' },
      notice,
    };
  }
}

export interface InterpretedChange {
  parsed: ParsedChange;
  source: AiSource;
  notice: string | null;
}

export const CHANGE_HELP =
  'Try something like “50 more guests”, “budget is now 7 lakh” or “2 weeks earlier”.';

/** Rules first, because they are instant and exact. The AI is asked only when the rules understood nothing. */
export async function interpretChange(
  profile: EventProfile,
  text: string,
  today: string,
): Promise<InterpretedChange> {
  const local = parseChangeText(text, today);
  if (local.changes.length > 0 || local.clarifications.length > 0)
    return { parsed: local, source: 'rules', notice: null };
  try {
    const result = await requestAi(toParseChangeRequest(profile, text, today));
    const parsed = changesFromAiOutput(result.data);
    if (parsed.changes.length === 0 && parsed.clarifications.length === 0) {
      return {
        parsed: { changes: [], clarifications: [CHANGE_HELP] },
        source: result.source,
        notice: null,
      };
    }
    return { parsed, source: result.source, notice: null };
  } catch (error) {
    const { fallback, notice } = noticeFor(error);
    if (!fallback) throw new AiInputError(notice);
    return { parsed: { changes: [], clarifications: [CHANGE_HELP] }, source: 'rules', notice };
  }
}
