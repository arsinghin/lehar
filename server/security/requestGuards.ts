/** Request-level guards applied before any parsing or model call. */

export const MAX_BODY_BYTES = 8 * 1024;

/**
 * Same-origin policy for the API. Browsers send Sec-Fetch-Site and Origin on fetch POSTs, so a
 * cross-site page cannot spend this deployment's AI quota. Requests without these headers
 * (server-to-server tools) are allowed but still rate limited.
 */
export function isAllowedOrigin(request: Request, allowedOrigins: readonly string[]): boolean {
  const origin = request.headers.get('origin');
  if (origin && allowedOrigins.includes(origin)) return true;

  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  if (!origin) return true;

  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    new URL(request.url).host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function isJsonContentType(request: Request): boolean {
  const type = request.headers.get('content-type') ?? '';
  return /^application\/json\b/i.test(type.trim());
}

export type BodyResult = { ok: true; text: string } | { ok: false };

/** Reads the body, refusing anything larger than `maxBytes` (declared or actual). */
export async function readBoundedBody(
  request: Request,
  maxBytes = MAX_BODY_BYTES,
): Promise<BodyResult> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false };
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) return { ok: false };
  return { ok: true, text };
}
