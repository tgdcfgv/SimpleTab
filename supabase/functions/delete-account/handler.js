const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store'
};

// Dependencies are injected so the authorization boundary can be tested locally.
export function createDeleteAccountHandler({ url, anonKey, serviceKey, fetcher = fetch }) {
  const reply = (status, message) => new Response(JSON.stringify({ message }), {
    status, headers: { ...cors, 'Content-Type': 'application/json' }
  });
  return async request => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, '仅支持 POST 请求。');
    if (!url || !anonKey || !serviceKey) return reply(503, '注销服务尚未配置，请稍后重试。');
    const authorization = request.headers.get('Authorization') || '';
    if (!/^Bearer \S+$/i.test(authorization)) return reply(401, '请先登录。');
    try {
      const body = await request.json();
      if (body?.confirmation !== 'DELETE' || !/^\d{6,10}$/.test(body?.code || '')) return reply(400, '请输入有效的邮箱验证码。');
      // Resolve identity on the Auth server; never trust a client-supplied user ID.
      const auth = await fetcher(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: authorization } });
      if (!auth.ok) return reply(401, '登录已失效，请重新登录。');
      const user = await auth.json();
      if (!user?.id || !user.email) return reply(401, '无法验证账户身份。');
      const verification = await fetcher(`${url}/auth/v1/verify`, {
        method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, token: body.code, type: 'email' })
      });
      if (!verification.ok) return reply(400, '验证码无效或已过期，请重新获取。');
      const verified = await verification.json();
      if (verified?.user?.id !== user.id || !verified.access_token) return reply(403, '邮箱验证与当前账户不一致。');
      // Revoke all refresh sessions before deleting. Existing JWTs cannot read data
      // after the owned row is cascaded away or recreate it without an auth user.
      const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
      const revoked = await fetcher(`${url}/auth/v1/logout?scope=global`, {
        method: 'POST', headers: { apikey: anonKey, Authorization: `Bearer ${verified.access_token}` }
      });
      if (!revoked.ok) return reply(503, '暂时无法结束账户会话，请重新获取验证码后重试。');
      const removed = await fetcher(`${url}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
        method: 'DELETE', headers, body: JSON.stringify({ should_soft_delete: false })
      });
      if (!removed.ok) return reply(503, '账户尚未注销，请重新登录后重试。');
      return reply(200, '账户已注销。');
    } catch {
      return reply(503, '注销失败，请稍后重试；如已完成邮箱验证，请重新获取验证码。');
    }
  };
}
