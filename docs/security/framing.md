# Framing protection (FRE-19)

Orbit is a personal dashboard and must not be embedded in another page, including
one on the same origin. `next.config.mjs` sends these enforcing response headers
on all Next.js routes, including the shared login/dashboard document and 404s:

```
Content-Security-Policy: frame-ancestors 'none'
X-Frame-Options: DENY
```

This CSP directive controls who can embed Orbit. It does not restrict scripts,
styles, fonts, Supabase connections, or Analytics; it is not a complete CSP policy.
Keep these headers if adding other CSP directives. No middleware is required.

## Local verification

Build with test-only public Supabase configuration and start a loopback server:

```
npm run build
npm run start -- --hostname 127.0.0.1 --port 3219
```

In a second terminal run `npm run test:headers -- http://127.0.0.1:3219`.
This checks actual GET/HEAD responses and a nested 404; it sends no credentials
and accepts only loopback HTTP URLs. It does not reproduce an authenticated attack.

## Owner acceptance after deployment

After the reviewed change is merged and deployed, open Orbit in DevTools →
Network, reload, select the final document request, and check **Response Headers**
for both values above. Repeat on a nonexistent path. Check actual enforcing CSP,
not `Content-Security-Policy-Report-Only`, and account for provider/CDN overrides.
Record the deployment and observed values in FRE-19 before closing it as mitigated.

The earlier authenticated clickjacking hypothesis remains unconfirmed. These
headers are preventive hardening, not proof that an attack succeeded. Any separate
attack reproduction must use the audit skill's complete isolated browser setup
and dummy data; do not use production credentials or disable browser protections.
