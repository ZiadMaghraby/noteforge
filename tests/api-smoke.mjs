import assert from 'node:assert/strict';
const base = process.env.NOTEFORGE_TEST_URL ?? 'http://localhost:5173';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Run smoke checks only against a local test workspace');
const signIn = await fetch(`${base}/signin-with-chatgpt?return_to=%2F`, { redirect: 'manual' });
assert.equal(signIn.status, 302);
const cookie = signIn.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
async function call(path, method = 'GET', data, extra = {}) {
  const response = await fetch(base + path, { method, headers: { Cookie: cookie, ...(data ? { 'Content-Type': 'application/json' } : {}), ...extra }, ...(data ? { body: JSON.stringify(data) } : {}) });
  const text = await response.text();
  return { status: response.status, data: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : { error: text } };
}
const unauthorized = await fetch(`${base}/api/workspace`); assert.equal(unauthorized.status, 401);
const workspace = await call('/api/workspace'); assert.equal(workspace.status, 200); assert.ok(workspace.data.pages.length >= 1);
const parent = await call('/api/pages', 'POST', { title: 'API smoke test (disposable)' }); assert.equal(parent.status, 201);
const child = await call('/api/pages', 'POST', { title: 'Nested smoke test', parentId: parent.data.id }); assert.equal(child.status, 201);
const cycle = await call(`/api/pages/${parent.data.id}`, 'PATCH', { version: 1, parentId: child.data.id }); assert.equal(cycle.status, 400);
const save = await call(`/api/pages/${parent.data.id}`, 'PATCH', { version: 1, title: 'Verified save (disposable)' }); assert.equal(save.status, 200); assert.equal(save.data.version, 2);
const stale = await call(`/api/pages/${parent.data.id}`, 'PATCH', { version: 1, title: 'Must not overwrite' }); assert.equal(stale.status, 409);
const otherOwner = await call('/api/pages', 'POST', { ownerId: 'someone-else' }); assert.equal(otherOwner.status, 400);
const nonexistentParent = await call('/api/pages', 'POST', { parentId: 'another-users-page' }); assert.equal(nonexistentParent.status, 404);
const badOrigin = await call(`/api/pages/${parent.data.id}`, 'PATCH', { version: 2, title: 'Rejected' }, { Origin: 'https://unrelated.test' }); assert.equal(badOrigin.status, 403);
const readBack = await call('/api/workspace'); assert.equal(readBack.data.pages.find(p => p.id === parent.data.id).title, 'Verified save (disposable)');
assert.equal((await call(`/api/pages/${child.data.id}`, 'PATCH', { version: 1, archived: true })).status, 200);
assert.equal((await call(`/api/pages/${parent.data.id}`, 'PATCH', { version: 2, archived: true })).status, 200);
console.log('API smoke checks passed: authentication, persistence, version conflict, input validation, parent ownership, cycle protection, cross-origin rejection, and recoverable trash.');
