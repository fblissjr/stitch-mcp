import { randomBytes } from 'crypto';

/**
 * Build CSP headers and inject nonces into script tags.
 * Used by both the Vite dev server and the in-memory HTML server.
 */
export function buildCspResponse(html: string): { headers: Record<string, string>; html: string } {
  const nonce = randomBytes(16).toString('base64');
  const csp = [
    "default-src 'self' data: https:;",
    `script-src 'self' 'nonce-${nonce}';`,
    "style-src 'self' 'unsafe-inline';",
    "object-src 'none';",
    "base-uri 'self';",
  ].join(' ');
  return {
    headers: {
      'Content-Security-Policy': csp,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
    html: html.replace(/<script(\b[^>]*)>/gi, `<script$1 nonce="${nonce}">`),
  };
}
