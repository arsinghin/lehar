/** JSON responses with safe defaults: never cached, never sniffed. */
import type { AiErrorBody, AiErrorCode } from '../src/core/contract.js';

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
} as const;

/** A JSON response with headers that stop caching and content sniffing. */
export function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, ...headers } });
}

/** The standard error envelope: a code for programs, a plain message for people, and the request id. */
export interface ErrorMeta {
  requestId: string;
  headers?: Record<string, string>;
}

export function errorResponse(
  status: number,
  code: AiErrorCode,
  message: string,
  { requestId, headers = {} }: ErrorMeta,
): Response {
  const body: AiErrorBody = { ok: false, error: { code, message }, requestId };
  return jsonResponse(status, body, { 'X-Request-Id': requestId, ...headers });
}
