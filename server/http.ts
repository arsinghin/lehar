/** JSON responses with safe defaults: never cached, never sniffed. */
import type { AiErrorCode } from '../src/core/contract.js';

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
} as const;

export function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, ...headers } });
}

export function errorResponse(
  status: number,
  code: AiErrorCode,
  message: string,
  requestId: string,
  headers: Record<string, string> = {},
): Response {
  return jsonResponse(
    status,
    { ok: false, error: { code, message }, requestId },
    { 'X-Request-Id': requestId, ...headers },
  );
}
