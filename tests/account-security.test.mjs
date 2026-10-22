import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeleteAccountHandler } from '../supabase/functions/delete-account/handler.js';
import { cloud } from '../js/cloud.js';

const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
const request = (body = { code: '12345678', confirmation: 'DELETE' }, token = 'user-token') => new Request('https://example.test', {
  method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body)
});
const user = { id: 'user-a', email: 'owner@example.test' };
const config = { url: 'https://auth.example.test', anonKey: 'public', serviceKey: 'secret' };

test('deletion rejects missing credentials and unconfirmed requests without touching Auth', async () => {
  let calls = 0;
  const handler = createDeleteAccountHandler({ ...config, fetcher: async () => { calls++; } });
  assert.equal((await handler(request(undefined, ''))).status, 401);
  assert.equal((await handler(request({ code: '12345678' }))).status, 400);
  assert.equal(calls, 0);
});

test('deletion verifies ownership and OTP, revokes sessions, then deletes only authenticated user', async () => {
  const calls = [];
  const handler = createDeleteAccountHandler({ ...config, fetcher: async (url, options) => {
    calls.push(url);
    if (url.endsWith('/user')) return json(user);
    if (url.endsWith('/verify')) {
      assert.equal(JSON.parse(options.body).email, user.email);
      return json({ user, access_token: 'verified-token' });
    }
    if (url.includes('/logout?')) {
      assert.equal(options.headers.Authorization, 'Bearer verified-token');
      return new Response(null, { status: 204 });
    }
    assert.match(url, /admin\/users\/user-a$/);
    assert.equal(options.method, 'DELETE');
    assert.equal(options.headers.apikey, 'secret');
    return json({});
  } });
  assert.equal((await handler(request({ code: '12345678', confirmation: 'DELETE', user_id: 'victim' }))).status, 200);
  assert.equal(calls.length, 4);
});

test('invalid OTP, mismatched identity, and failed revocation never reach deletion', async () => {
  for (const failure of ['auth', 'otp', 'identity', 'revoke']) {
    let deleted = false;
    const handler = createDeleteAccountHandler({ ...config, fetcher: async url => {
      if (url.endsWith('/user')) return json(user, failure === 'auth' ? 401 : 200);
      if (url.endsWith('/verify')) return json({ user: failure === 'identity' ? { id: 'other' } : user, access_token: 'verified' }, failure === 'otp' ? 400 : 200);
      if (url.includes('/logout?')) return json({}, 503);
      deleted = true; return json({});
    } });
    assert.ok((await handler(request())).status >= 400);
    assert.equal(deleted, false);
  }
});

test('failed deletion returns an error rather than success', async () => {
  const handler = createDeleteAccountHandler({ ...config, fetcher: async url => {
    if (url.endsWith('/user')) return json(user);
    if (url.endsWith('/verify')) return json({ user, access_token: 'verified' });
    return json({}, url.includes('/logout?') ? 200 : 500);
  } });
  assert.equal((await handler(request())).status, 503);
});

const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
const session = { user, access_token: 'old', refresh_token: 'refresh', expires_at: Date.now() / 1000 + 3600 };
test('failed remote deletion retains local session; success clears credentials', async () => {
  cloud.storeSession(session);
  globalThis.fetch = async () => json({ message: 'failed' }, 503);
  await assert.rejects(cloud.deleteAccount('12345678'));
  assert.equal(cloud.session.user.id, user.id);
  globalThis.fetch = async () => json({});
  await cloud.deleteAccount('12345678');
  assert.equal(cloud.session, null);
  assert.equal(values.has('simtab.auth'), false);
});
