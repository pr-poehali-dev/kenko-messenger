const CHATS_URL = 'https://functions.poehali.dev/9c30b3c8-6a48-46d4-bcc7-b4de36725530';

export type ChatSummary = {
  id: number;
  type: 'private' | 'group';
  name: string | null;
  avatar_url: string | null;
  last_message: string | null;
  last_type: string | null;
  last_time: string | null;
  last_sender_id: number | null;
  unread: number;
};

export type Message = {
  id: number;
  sender_id: number;
  text: string;
  type: string;
  media_url: string | null;
  created_at: string;
  sender_name: string;
};

function tokenHeaders(): Record<string, string> {
  const t = localStorage.getItem('kenko_token');
  return t ? { 'X-Auth-Token': t } : {};
}

async function req(action: string, opts: { method?: string; body?: unknown; qs?: string } = {}) {
  const qs = opts.qs ? `&${opts.qs}` : '';
  const res = await fetch(`${CHATS_URL}?action=${action}${qs}`, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...tokenHeaders() },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
  return data;
}

export const chatsApi = {
  list: (): Promise<{ chats: ChatSummary[] }> => req('list'),
  messages: (chatId: number, afterId = 0): Promise<{ messages: Message[] }> =>
    req('messages', { qs: `chat_id=${chatId}&after_id=${afterId}` }),
  send: (chatId: number, text: string) =>
    req('send', { method: 'POST', body: { chat_id: chatId, text, type: 'text' } }),
  createPrivate: (phone: string) =>
    req('create_private', { method: 'POST', body: { phone } }),
  createGroup: (name: string, phones: string[]) =>
    req('create_group', { method: 'POST', body: { name, phones } }),
};
