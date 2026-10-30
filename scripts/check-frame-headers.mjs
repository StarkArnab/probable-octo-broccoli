import assert from 'node:assert/strict';

// Exercise an already running local server, never production or a private session.
const base = new URL(process.argv[2] || 'http://127.0.0.1:3000');
assert.equal(base.protocol, 'http:');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'Use a loopback server');
assert.ok(!base.username && !base.password, 'Do not supply credentials');

for (const [path, method, status] of [
  ['/', 'GET', 200],
  ['/?header-check=1', 'GET', 200],
  ['/', 'HEAD', 200],
  ['/__frame_header_check__/missing', 'GET', 404],
]) {
  const response = await fetch(new URL(path, base), {
    method,
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(response.status, status, `${method} ${path}: status`);
  assert.equal(response.headers.get('content-security-policy'), "frame-ancestors 'none'", `${method} ${path}: enforcing CSP`);
  assert.equal(response.headers.get('x-frame-options'), 'DENY', `${method} ${path}: legacy framing protection`);
  await response.body?.cancel();
  console.log(`PASS ${method} ${path}: framing denied`);
}
