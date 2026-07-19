import type { NextConfig } from "next";

/*
 * Content-Security-Policy. The browser renders no user-supplied HTML and calls
 * no third-party origins directly — the demo runs the billing core client-side,
 * and Neon/QStash are only ever reached from server routes. So the policy stays
 * tight. Notes:
 *  - 'unsafe-inline' in style-src: a few panels use inline style={{…}}.
 *  - 'unsafe-inline' in script-src: Next injects an inline bootstrap script. A
 *    nonce-based policy is stricter but needs per-request middleware; there is
 *    no injection sink for an attacker to reach here, so it is not worth it.
 *  - worker-src 'self' blob:: the invariant harness runs in a bundled Web Worker.
 *  - connect-src 'self': the only fetch targets (/api/*) are same-origin.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The Playwright dev server is reached over 127.0.0.1; allow it so HMR is not
  // blocked as a cross-origin request during e2e runs. No effect in production.
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // The CSP protects the deployed site. It is skipped in development so
          // it doesn't block the eval() and websockets React/Turbopack use for
          // hot reload — React never uses eval() in production.
          ...(isProd ? [{ key: "Content-Security-Policy", value: CSP }] : []),
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
