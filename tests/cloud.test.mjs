import test from 'node:test';
import assert from 'node:assert/strict';
import { cloud, parseAuthUrl } from '../js/cloud.js';
const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
const session = () => ({ access_token: 'test-token', refresh_token: 'refresh-token', expires_at: Date.now() / 1000 + 3600, user: { id: 'user-a', email: 'test@example.test' } });
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });

test('data API reads leave account snapshot caching to the sync manager', async () => {
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

test('failed cloud writes do not cache unconfirmed account data', async () => {
  cloud.storeSession(session());
  globalThis.fetch = async () => { throw new TypeError('offline'); };
  await assert.rejects(cloud.write({ private: 'bookmark' }, 2), error => error.cause?.message === 'offline');
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

test('handleAuthCallback extracts session from URL hash and clears it', async () => {
  cloud.storeSession(null);
  let replacedUrl = '';
  globalThis.window = {
    location: {
      hash: '#access_token=hash-token&refresh_token=hash-refresh&expires_in=7200&type=magiclink',
      pathname: '/newtab.html',
      search: ''
    }
  };
  globalThis.history = {
    replaceState: (state, title, url) => { replacedUrl = url; }
  };
  const res = cloud.handleAuthCallback();
  assert.equal(res.session.access_token, 'hash-token');
  assert.equal(cloud.session, null); // Must validate the user before accepting URL credentials.
  assert.equal(replacedUrl, '/newtab.html');
});

test('verifyOtp handles token_hash and fallback type', async () => {
  cloud.storeSession(null);
  let calledBody = null;
  globalThis.fetch = async (url, options) => {
    calledBody = JSON.parse(options.body);
    return response(session());
  };
  const result = await cloud.verifyOtp({ token_hash: 'pkce_hash_123', type: 'signup' });
  assert.equal(calledBody.token_hash, 'pkce_hash_123');
  assert.equal(calledBody.type, 'signup');
  assert.equal(result.access_token, 'test-token');
});


test('OTP redirect is a query parameter, including extension origins', async () => {
  for (const href of ['https://simtab.example/newtab.html?old=1#old', 'chrome-extension://abc/newtab.html']) {
    globalThis.window = { location: { href } };
    globalThis.fetch = async (url, options) => {
      assert.equal(new URL(url).searchParams.get('redirect_to'), href.split('?')[0].split('#')[0]);
      assert.deepEqual(JSON.parse(options.body), { email: 'user@example.test', create_user: true });
      return response({});
    };
    await cloud.sendOtp('user@example.test');
  }
  delete globalThis.window;
});

test('accepting a pasted callback validates and persists the user', async () => {
  cloud.storeSession(null);
  globalThis.fetch = async (url, options) => {
    assert.match(url, /\/auth\/v1\/user$/);
    assert.equal(options.headers.Authorization, 'Bearer link-token');
    return response(session().user);
  };
  const result = await cloud.verifyEmailInput('http://localhost:3000/#access_token=link-token&refresh_token=link-refresh&expires_in=3600');
  assert.equal(result.user.id, 'user-a');
  assert.equal(JSON.parse(values.get('simtab.auth')).user.id, 'user-a');
});

test('eight digit OTP is sent as an email token, not a hash', async () => {
  globalThis.fetch = async (url, options) => {
    assert.deepEqual(JSON.parse(options.body), { email: 'user@example.test', token: '12345678', type: 'email' });
    return response(session());
  };
  await cloud.verifyEmailInput('12345678', 'user@example.test');
});

test('unused signup links preserve their verification type', async () => {
  globalThis.fetch = async (url, options) => {
    assert.deepEqual(JSON.parse(options.body), { token_hash: 'unused-hash', type: 'signup' });
    return response(session());
  };
  await cloud.verifyEmailInput('https://example.test/verify?token=unused-hash&type=signup');
});

test('invalid verification responses cannot report a successful login', async () => {
  cloud.storeSession(null);
  globalThis.fetch = async () => response({});
  await assert.rejects(cloud.verifyOtp({ email: 'user@example.test', token: '123456' }), /有效登录信息/);
  assert.equal(cloud.session, null);
  await assert.rejects(cloud.verifyEmailInput('https://example.test/'), /未包含有效/);
  await assert.rejects(cloud.verifyEmailInput('https://example.test/#error=access_denied&error_description=expired'), /过期/);
  assert.equal(parseAuthUrl('https://example.test/#access_token=incomplete').session, undefined);
});

test('HTML gateway errors produce a retryable message instead of JSON errors', async () => {
  globalThis.fetch = async () => new Response('<html>Bad Gateway</html>', { status: 502 });
  await assert.rejects(cloud.sendOtp('user@example.test'), error => error.status === 502 && /稍后重试/.test(error.message));
});
