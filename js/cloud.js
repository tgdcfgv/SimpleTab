import { t } from './i18n.js';
import { clearCloudCache } from './cloud-cache.js';

// Public client configuration. Never put a service_role key here.
export const SUPABASE_URL = 'https://zyttspnlrdzjosnitijb.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_VYNEnxYwYEWMoQgSH7nKNQ_elImzIYs';
const SESSION_KEY = 'simtab.auth';

// Mail links may contain an unused token hash or an already-issued session.
export function parseAuthUrl(value) {
  const url = new URL(value);
  const hash = new URLSearchParams(url.hash.slice(1));
  const error = hash.get('error_description') || hash.get('error') || url.searchParams.get('error_description') || url.searchParams.get('error');
  if (error) return { error: t('验证链接无效或已过期，请重新发送邮件并使用最新链接。') };
  if (hash.has('access_token')) {
    if (!hash.get('refresh_token')) return { error: t('验证链接不完整，请复制完整链接。') };
    const expiresIn = Number(hash.get('expires_in') || 3600);
    return { session: {
      access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token'),
      expires_at: Number(hash.get('expires_at')) || Math.floor(Date.now() / 1000) + (Number.isFinite(expiresIn) ? expiresIn : 3600),
      needs_choice: false
    } };
  }
  const tokenHash = url.searchParams.get('token_hash') || url.searchParams.get('token');
  return tokenHash ? { tokenHash, type: url.searchParams.get('type') || 'email' } : null;
}

export const cloud = {
  session: null,
  async request(path, { method = 'GET', body, token, headers = {} } = {}) {
    let response;
    try {
      response = await fetch(`${SUPABASE_URL}${path}`, {
        method, cache: 'no-store', signal: AbortSignal.timeout(20000),
        headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
    } catch (networkError) {
      const err = new Error(t('连接失败，请稍后重试'));
      err.cause = networkError;
      throw err;
    }
    const text = await response.text();
    let result = null;
    try { result = text ? JSON.parse(text) : null; }
    catch {
      const error = new Error(t('云端服务暂时无法响应，请稍后重试'));
      error.status = response.status;
      throw error;
    }
    if (!response.ok) {
      const messages = {
        invalid_credentials: t('邮箱或密码不正确'),
        email_not_confirmed: t('请先完成邮箱验证，再登录'),
        email_address_not_authorized: t('邮件服务尚未开放此邮箱，请联系管理员配置 SMTP 发信服务'),
        over_email_send_rate_limit: t('操作过于频繁，请稍后再试'),
        over_request_rate_limit: t('操作过于频繁，请稍后再试'),
        otp_expired: t('验证码或验证链接已过期，请重新获取'),
        invalid_grant: t('验证码或验证链接无效，请重新输入或获取新邮件'),
        bad_jwt: t('验证码或验证链接无效，请重新输入'),
        weak_password: t('密码强度不足，请使用更长、更复杂的密码')
      };
      const error = new Error(messages[result?.error_code || result?.code] || result?.msg || result?.message || result?.error_description || t('云端请求失败，请重试。'));
      error.status = response.status;
      error.code = result?.error_code || result?.code;
      throw error;
    }
    return result;
  },
  broadcastAuth(action, data = {}) {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('simtab-auth-sync');
        channel.postMessage({ action, ...data, timestamp: Date.now() });
        channel.close();
      }
    } catch {}
  },
  handleAuthCallback() {
    if (typeof window === 'undefined') return null;
    const result = parseAuthUrl(window.location.href || `https://callback.invalid${window.location.pathname}${window.location.search}${window.location.hash}`);
    if (result) {
      // Remove credentials even when verification fails; never leave them in history.
      try { history.replaceState(null, '', window.location.pathname); } catch {}
    }
    return result;
  },
  async acceptSession(session) {
    if (!session?.access_token || !session.refresh_token) throw new Error(t('验证未返回有效登录信息，请重新获取邮件。'));
    let verified = session;
    if (session.expires_at <= Date.now() / 1000 + 60) {
      verified = await this.request('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', body: { refresh_token: session.refresh_token }
      });
    }
    const user = await this.request('/auth/v1/user', { token: verified.access_token });
    this.storeSession({ ...verified, user, needs_choice: false });
    this.broadcastAuth('login');
    return this.session;
  },
  async verifyEmailInput(value, email) {
    if (/^https?:\/\//i.test(value)) {
      const parsed = parseAuthUrl(value);
      if (parsed?.error) throw new Error(parsed.error);
      if (parsed?.session) return this.acceptSession(parsed.session);
      if (!parsed?.tokenHash) throw new Error(t('此链接中未包含有效的验证信息，请复制完整链接。'));
      return this.verifyOtp({ token_hash: parsed.tokenHash, type: parsed.type });
    }
    if (/^\d{6,10}$/.test(value)) return this.verifyOtp({ email, token: value, type: 'email' });
    throw new Error(t('请输入邮件中的验证码或完整验证链接。'));
  },
  storeSession(session) {
    let previousUserId = this.session?.user?.id;
    try { previousUserId ||= JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')?.user?.id; } catch {}
    this.session = session?.access_token ? {
      access_token: session.access_token, refresh_token: session.refresh_token,
      expires_at: session.expires_at || Math.floor(Date.now() / 1000) + session.expires_in,
      user: session.user,
      needs_choice: session.needs_choice ?? (this.session?.user?.id === session.user?.id && this.session?.needs_choice) ?? false
    } : null;
    if (this.session) localStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
    else localStorage.removeItem(SESSION_KEY);
    if (previousUserId && previousUserId !== this.session?.user?.id) void clearCloudCache(previousUserId);
  },
  async restore() {
    const callbackResult = this.handleAuthCallback();
    this.authError = callbackResult?.error || '';
    if (callbackResult?.session || callbackResult?.tokenHash) {
      try {
        if (callbackResult.session) await this.acceptSession(callbackResult.session);
        else await this.verifyOtp({ token_hash: callbackResult.tokenHash, type: callbackResult.type });
      } catch (error) {
        this.authError = error.message;
      }
    }

    try { this.session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { this.storeSession(null); }
    if (!this.session) return null;
    try {
      const token = await this.token();
      // The data API verifies the token too; do not add a serial user request on every tab.
      if (this.session.user?.id) return this.session.user;
      const user = await this.request('/auth/v1/user', { token });
      this.storeSession({ ...this.session, user });
      return user;
    } catch (error) {
      if ([400, 401, 403].includes(error.status)) this.storeSession(null);
      throw error;
    }
  },
  async token() {
    const refresh = async () => {
      // Re-read after taking the lock: another tab may have rotated the token.
      const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (!saved || saved.user?.id !== this.session?.user?.id) throw new Error(t('登录已失效，请重新登录。'));
      this.session = saved;
      if (saved.expires_at > Date.now() / 1000 + 60) return saved.access_token;
      const session = await this.request('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', body: { refresh_token: saved.refresh_token }
      });
      this.storeSession(session);
      return session.access_token;
    };
    if (navigator.locks) return navigator.locks.request('simtab-auth-refresh', refresh);
    if (!this.refreshing) this.refreshing = refresh().finally(() => { this.refreshing = null; });
    return this.refreshing;
  },
  async updateProfile(nickname, avatar) {
    const token = await this.token();
    const userId = this.session.user.id;
    const user = await this.request('/auth/v1/user', {
      method: 'PUT', token, body: { data: { nickname, avatar_emoji: avatar, profile_completed: true } }
    });
    if (this.session?.user?.id !== userId) throw new Error(t('账户已更改，请刷新后重试。'));
    this.storeSession({ ...this.session, user });
    document.dispatchEvent(new Event('simtab-sync'));
  },
  async sendSecurityCode() {
    await this.token();
    return this.request('/auth/v1/otp', {
      method: 'POST', body: { email: this.session.user.email, create_user: false }
    });
  },
  async deleteAccount(code) {
    const userId = this.session?.user?.id;
    await this.request('/functions/v1/delete-account', {
      method: 'POST', token: await this.token(), body: { code, confirmation: 'DELETE' }
    });
    if (this.session?.user?.id === userId) this.storeSession(null);
    this.broadcastAuth('logout');
  },
  async sendOtp(email) {
    const location = typeof window === 'undefined' ? null : window.location;
    // Extension origins can be "null"; use href to retain chrome-extension://.
    const pageUrl = location?.href ? new URL(location.href) : null;
    const redirectTo = pageUrl ? `${pageUrl.protocol}//${pageUrl.host}${pageUrl.pathname}` : null;
    return this.request(`/auth/v1/otp${redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ''}`, {
      method: 'POST', body: { email, create_user: true }
    });
  },
  async verifyOtp({ email, token, token_hash, type = 'email' }) {
    let body;
    if (token_hash) {
      body = { token_hash, type };
    } else {
      body = { email, token, type };
    }
    let session;
    try {
      session = await this.request('/auth/v1/verify', { method: 'POST', body });
    } catch (error) {
      if (!token_hash && (error.code === 'invalid_grant' || error.status === 400)) {
        try {
          session = await this.request('/auth/v1/verify', {
            method: 'POST',
            body: { email, token, type: 'signup' }
          });
        } catch {
          throw error;
        }
      } else if (token_hash && (error.code === 'invalid_grant' || error.status === 400) && type !== 'signup') {
        try {
          session = await this.request('/auth/v1/verify', {
            method: 'POST',
            body: { token_hash, type: 'signup' }
          });
        } catch {
          throw error;
        }
      } else {
        throw error;
      }
    }
    if (!session?.access_token || !session.refresh_token || !session.user?.id) throw new Error(t('验证未返回有效登录信息，请重新获取邮件。'));
    this.storeSession({ ...session, needs_choice: false });
    this.broadcastAuth('login');
    return session;
  },
  async login(email, password) {
    const session = await this.request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
    this.storeSession({ ...session, needs_choice: true });
  },
  async signup(email, password) {
    const session = await this.request('/auth/v1/signup', { method: 'POST', body: { email, password } });
    if (session.access_token) this.storeSession({ ...session, needs_choice: true });
    return Boolean(session.access_token);
  },
  async logout() {
    try { await this.request('/auth/v1/logout?scope=local', { method: 'POST', token: await this.token() }); }
    finally { this.storeSession(null); }
  },
  async read() {
    const token = await this.token();
    const rows = await this.request(`/rest/v1/account_data?user_id=eq.${this.session.user.id}&select=data,revision`, { token });
    return rows[0] || null;
  },
  async write(data, revision) {
    const token = await this.token();
    const user_id = this.session.user.id;
    let rows;
    try {
      rows = await this.request(`/rest/v1/account_data${revision === null ? '' : `?user_id=eq.${user_id}&revision=eq.${revision}`}`, {
        token, method: revision === null ? 'POST' : 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: revision === null ? { user_id, data, revision: 1 } : { data, revision: revision + 1 }
      });
    } catch (error) {
      if (error.status !== 409) throw error;
      rows = [];
    }
    if (!rows.length) {
      const error = new Error(t('其他设备已更新数据。请先导出未保存的更改，再点击“读取云端版本”。'));
      error.conflict = true;
      throw error;
    }
    return rows[0].revision;
  }
};
