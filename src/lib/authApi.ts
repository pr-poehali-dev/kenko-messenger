const AUTH_URL = 'https://functions.poehali.dev/c5b03fda-8ea1-4e13-aa6d-db87f6494032';

export type User = {
  id: number;
  phone: string;
  name: string | null;
  status: string | null;
  avatar_url: string | null;
};

function tokenHeaders(): Record<string, string> {
  const t = localStorage.getItem('kenko_token');
  return t ? { 'X-Auth-Token': t } : {};
}

async function call(action: string, opts: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`${AUTH_URL}?action=${action}`, {
    method: opts.method || 'POST',
    headers: { 'Content-Type': 'application/json', ...tokenHeaders() },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
  return data;
}

export const authApi = {
  sendCode: (phone: string) => call('send_code', { body: { phone } }),
  verifyCode: (phone: string, code: string) =>
    call('verify_code', { body: { phone, code } }),
  me: () => call('me', { method: 'GET' }),
  updateProfile: (name: string, status: string, avatar_url?: string) =>
    call('update_profile', { body: { name, status, avatar_url } }),
  logout: () => call('logout', {}),
};
