import test from 'node:test';
import assert from 'node:assert/strict';
import { cloud } from '../js/cloud.js';
const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
const session = () => ({ access_token: 'test-token', refresh_token: 'refresh-token', expires_at: Date.now() / 1000 + 3600, user: { id: 'user-a', email: 'test@example.test' } });
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });

test('persists only the auth session, never account data', async () => {
  values.clear(); cloud.storeSession(session());
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    return response([{ data: { spaces: [] }, revision: 4 }]);
  };
  const row = await cloud.read();
  assert.equal(row.revision, 4);
  assert.deepEqual([...values.keys()], ['simtab.auth']);
  assert.equal(JSON.parse(values.get('simtab.auth')).data, undefined);
});

test('refreshes expired auth before accessing cloud data', async () => {
  cloud.storeSession({ ...session(), expires_at: 1 });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(url);
    if (url.includes('/token?')) {
      assert.equal(JSON.parse(options.body).refresh_token, 'refresh-token');
      return response({ ...session(), access_token: 'new-token' });
    }
    assert.equal(options.headers.Authorization, 'Bearer new-token');
    return response([]);
  };
  await cloud.read();
  assert.equal(calls.length, 2);
});

test('conditional saves reject another device revision instead of overwriting', async () => {
  cloud.storeSession(session());
  globalThis.fetch = async (url, options) => {
    assert.match(url, /user_id=eq.user-a&revision=eq.4/);
    assert.equal(options.method, 'PATCH');
    assert.equal(JSON.parse(options.body).revision, 5);
    return response([]);
  };
  await assert.rejects(cloud.write({ spaces: [] }, 4), error => error.conflict === true);
});

test('simultaneous first writes report a conflict', async () => {
  cloud.storeSession(session());
  globalThis.fetch = async () => response({ message: 'duplicate key' }, 409);
  await assert.rejects(cloud.write({}, null), error => error.conflict === true);
});

test('network failures are reported without caching account data', async () => {
  cloud.storeSession(session());
  globalThis.fetch = async () => { throw new TypeError('offline'); };
  await assert.rejects(cloud.write({ private: 'bookmark' }, 2), /offline/);
  assert.equal(values.has('appData'), false);
});

test('sign out removes credentials even when remote logout fails', async () => {
  cloud.storeSession(session());
  globalThis.fetch = async () => response({ message: 'offline' }, 503);
  await assert.rejects(cloud.logout());
  assert.equal(cloud.session, null);
  assert.equal(values.has('simtab.auth'), false);
});


test('new login requires a direction choice and token refresh preserves it', async () => {
  cloud.storeSession(null);
  globalThis.fetch = async () => response(session());
  await cloud.login('test@example.test', 'password');
  assert.equal(cloud.session.needs_choice, true);
  cloud.storeSession({ ...cloud.session, expires_at: 1 });
  await cloud.token();
  assert.equal(cloud.session.needs_choice, true);
  cloud.storeSession({ ...cloud.session, needs_choice: false });
  assert.equal(JSON.parse(values.get('simtab.auth')).needs_choice, false);
});

test('sendOtp sends otp request with email and create_user', async () => {
  let calledUrl = '';
  let calledBody = null;
  globalThis.fetch = async (url, options) => {
    calledUrl = url;
    calledBody = JSON.parse(options.body);
    return response({});
  };
  await cloud.sendOtp('user@example.test');
  assert.match(calledUrl, /\/auth\/v1\/otp$/);
  assert.equal(calledBody.email, 'user@example.test');
  assert.equal(calledBody.create_user, true);
});

test('verifyOtp sends verification request and stores session directly', async () => {
  cloud.storeSession(null);
  let calledUrl = '';
  let calledBody = null;
  globalThis.fetch = async (url, options) => {
    calledUrl = url;
    calledBody = JSON.parse(options.body);
    return response(session());
  };
  const result = await cloud.verifyOtp({ email: 'user@example.test', token: '123456' });
  assert.match(calledUrl, /\/auth\/v1\/verify$/);
  assert.equal(calledBody.email, 'user@example.test');
  assert.equal(calledBody.token, '123456');
  assert.equal(calledBody.type, 'email');
  assert.equal(cloud.session.needs_choice, false);
  assert.equal(result.access_token, 'test-token');
});
