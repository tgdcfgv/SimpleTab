// Public client configuration. Never put a service_role key here.
export const SUPABASE_URL = 'https://zyttspnlrdzjosnitijb.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_VYNEnxYwYEWMoQgSH7nKNQ_elImzIYs';
const SESSION_KEY = 'simtab.auth';

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
      const err = new Error('连接失败，请稍后重试');
      err.cause = networkError;
      throw err;
    }
    const text = await response.text();
    const result = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const messages = {
        invalid_credentials: '邮箱或密码不正确',
        email_not_confirmed: '请先完成邮箱验证，再登录',
        email_address_not_authorized: '当前发信服务仅允许组织成员邮箱注册，请使用你的 Supabase 组织邮箱',
        over_email_send_rate_limit: '操作过于频繁，请稍后再试',
        over_request_rate_limit: '操作过于频繁，请稍后再试',
        otp_expired: '验证码或验证链接已过期，请重新获取',
        invalid_grant: '验证码或验证链接无效，请重新输入或获取新邮件',
        bad_jwt: '验证码或验证链接无效，请重新输入',
        weak_password: '密码强度不足，请使用更长、更复杂的密码'
      };
      const error = new Error(messages[result?.error_code || result?.code] || result?.msg || result?.message || result?.error_description || '云端请求失败，请重试。');
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
    try {
      // 1. 处理 Hash 参数 (Supabase 邮件链接点击重定向最常用的模式)
      const hash = window.location.hash ? window.location.hash.substring(1) : '';
      if (hash) {
        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const expiresIn = parseInt(hashParams.get('expires_in') || '3600', 10);
        const error = hashParams.get('error') || hashParams.get('error_description');

        if (error) {
          try {
            history.replaceState(null, document.title, window.location.pathname + window.location.search);
          } catch {}
          return { error: hashParams.get('error_description') || error };
        }

        if (accessToken) {
          const session = {
            access_token: accessToken,
            refresh_token: refreshToken || '',
            expires_at: Math.floor(Date.now() / 1000) + expiresIn,
            needs_choice: false
          };
          this.storeSession(session);
          try {
            history.replaceState(null, document.title, window.location.pathname + window.location.search);
          } catch {}
          this.broadcastAuth('login', { email: session.user?.email });
          return { session, type: hashParams.get('type') || 'magiclink' };
        }
      }

      // 2. 处理 Query 参数
      const searchParams = new URLSearchParams(window.location.search);
      const searchError = searchParams.get('error') || searchParams.get('error_description');
      if (searchError) {
        try {
          history.replaceState(null, document.title, window.location.pathname);
        } catch {}
        return { error: searchParams.get('error_description') || searchError };
      }

      const tokenHash = searchParams.get('token_hash') || searchParams.get('token');
      const type = searchParams.get('type') || 'email';
      if (tokenHash) {
        try {
          history.replaceState(null, document.title, window.location.pathname);
        } catch {}
        return { tokenHash, type };
      }
    } catch (e) {
      console.warn('handleAuthCallback error:', e);
    }
    return null;
  },
  storeSession(session) {
    this.session = session?.access_token ? {
      access_token: session.access_token, refresh_token: session.refresh_token,
      expires_at: session.expires_at || Math.floor(Date.now() / 1000) + session.expires_in,
      user: session.user,
      needs_choice: session.needs_choice ?? (this.session?.user?.id === session.user?.id && this.session?.needs_choice) ?? false
    } : null;
    if (this.session) localStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
    else localStorage.removeItem(SESSION_KEY);
  },
  async restore() {
    // 优先尝试从 URL 回调中解析登录状态
    const callbackResult = this.handleAuthCallback();
    if (callbackResult?.tokenHash) {
      try {
        await this.verifyOtp({ token_hash: callbackResult.tokenHash, type: callbackResult.type });
      } catch (err) {
        console.warn('URL token verification failed:', err);
      }
    }

    try { this.session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { this.storeSession(null); }
    if (!this.session) return null;
    try {
      const token = await this.token();
      this.session.user = await this.request('/auth/v1/user', { token });
      return this.session.user;
    } catch (error) {
      if ([400, 401, 403].includes(error.status)) this.storeSession(null);
      throw error;
    }
  },
  async token() {
    const refresh = async () => {
      // Re-read after taking the lock: another tab may have rotated the token.
      const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (!saved || saved.user?.id !== this.session?.user?.id) throw new Error('登录已失效，请重新登录。');
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
  async sendOtp(email) {
    const redirectTo = (typeof window !== 'undefined' && window.location?.origin)
      ? `${window.location.origin}${window.location.pathname}`
      : undefined;
    const body = {
      email,
      create_user: true
    };
    if (redirectTo) {
      body.options = { email_redirect_to: redirectTo };
      body.email_redirect_to = redirectTo;
    }
    return await this.request('/auth/v1/otp', {
      method: 'POST',
      body
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
    this.storeSession({ ...session, needs_choice: false });
    this.broadcastAuth('login', { email: session.user?.email });
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
      const error = new Error('其他设备已更新数据。请先导出未保存的更改，再点击“读取云端版本”。');
      error.conflict = true;
      throw error;
    }
    return rows[0].revision;
  }
};
