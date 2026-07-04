import { useState, useRef, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/context/AuthContext';
import AuthScreen from '@/components/AuthScreen';
import { chatsApi, ChatSummary, Message } from '@/lib/chatsApi';
import { toast } from '@/hooks/use-toast';

const AVATAR_COLORS = [
  'from-sky-400 to-blue-500',
  'from-cyan-400 to-sky-500',
  'from-blue-400 to-indigo-500',
  'from-pink-400 to-rose-500',
  'from-emerald-400 to-teal-500',
  'from-violet-400 to-purple-500',
];

const colorFor = (id: number) => AVATAR_COLORS[id % AVATAR_COLORS.length];

const initialsFor = (name: string | null) =>
  (name || '?')
    .trim()
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

const fmtTime = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('ru', { day: '2-digit', month: '2-digit' });
};

const StatusTicks = ({ read }: { read: boolean }) => (
  <span className="relative inline-flex w-[19px]">
    <Icon name="Check" size={15} className={read ? 'text-sky-200' : 'text-white/70'} />
    <Icon name="Check" size={15} className={`-ml-[9px] ${read ? 'text-sky-200' : 'text-white/70'}`} />
  </span>
);

const Index = () => {
  const { user, loading, logout } = useAuth();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState('');
  const [input, setInput] = useState('');
  const [recording, setRecording] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [creatingChat, setCreatingChat] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const lastMsgIdRef = useRef(0);

  const active = chats.find((c) => c.id === activeId) || null;

  const loadChats = useCallback(async () => {
    if (!user) return;
    try {
      const res = await chatsApi.list();
      setChats(res.chats);
    } catch {
      /* silent */
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadChats();
    const iv = setInterval(loadChats, 3000);
    return () => clearInterval(iv);
  }, [user, loadChats]);

  const loadMessages = useCallback(async (chatId: number, initial: boolean) => {
    try {
      const res = await chatsApi.messages(chatId, initial ? 0 : lastMsgIdRef.current);
      if (res.messages.length === 0) return;
      lastMsgIdRef.current = res.messages[res.messages.length - 1].id;
      setMessages((prev) => (initial ? res.messages : [...prev, ...res.messages]));
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    if (!activeId) return;
    lastMsgIdRef.current = 0;
    setMessages([]);
    loadMessages(activeId, true);
    const iv = setInterval(() => loadMessages(activeId, false), 2000);
    return () => clearInterval(iv);
  }, [activeId, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const openChat = (id: number) => {
    setActiveId(id);
  };

  const send = async () => {
    if (!input.trim() || !active || !user) return;
    const text = input;
    setInput('');
    const optimistic: Message = {
      id: -Date.now(),
      sender_id: user.id,
      text,
      type: 'text',
      media_url: null,
      created_at: new Date().toISOString(),
      sender_name: user.name || '',
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const res = await chatsApi.send(active.id, text);
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? { ...m, id: res.id, created_at: res.created_at } : m))
      );
      lastMsgIdRef.current = Math.max(lastMsgIdRef.current, res.id);
      loadChats();
    } catch (e) {
      toast({ title: (e as Error).message });
    }
  };

  const startNewChat = async () => {
    const digits = newChatPhone.replace(/\D/g, '');
    if (digits.length < 10) {
      toast({ title: 'Введите корректный номер телефона' });
      return;
    }
    let phone = digits;
    if (phone.startsWith('8') && phone.length === 11) phone = '7' + phone.slice(1);
    if (!phone.startsWith('7')) phone = '7' + phone;
    setCreatingChat(true);
    try {
      const res = await chatsApi.createPrivate('+' + phone);
      await loadChats();
      setActiveId(res.chat_id);
      setNewChatOpen(false);
      setNewChatPhone('');
    } catch (e) {
      toast({ title: (e as Error).message });
    } finally {
      setCreatingChat(false);
    }
  };

  const filtered = chats.filter((c) =>
    (c.name || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-secondary chat-bg">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-xl shadow-blue-500/30 animate-pulse">
          <Icon name="Send" size={28} className="text-white -rotate-12" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const initials = initialsFor(user.name);

  return (
    <div className="h-[100dvh] w-full bg-secondary flex justify-center overflow-hidden font-sans">
      <div className="w-full max-w-[1400px] h-full flex bg-background md:my-0 shadow-2xl md:shadow-none">
        {/* Sidebar / Chat list */}
        <aside
          className={`${
            active ? 'hidden md:flex' : 'flex'
          } flex-col w-full md:w-[380px] lg:w-[420px] border-r border-border bg-background shrink-0 relative`}
        >
          {/* Header */}
          <header className="px-5 pt-6 pb-3">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <Icon name="Send" size={20} className="text-white -rotate-12" />
                </div>
                <div>
                  <h1 className="text-[22px] font-extrabold font-display leading-none tracking-tight">Кенко</h1>
                  <span className="text-[11px] text-muted-foreground">всегда на связи</span>
                </div>
              </div>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="w-10 h-10 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground transition-colors"
                >
                  <Icon name="Menu" size={22} />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-12 z-30 w-60 bg-background rounded-2xl shadow-2xl border border-border p-2 animate-scale-in origin-top-right">
                      <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white font-semibold">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{user.name || 'Без имени'}</div>
                          <div className="text-[12px] text-muted-foreground truncate">{user.phone}</div>
                        </div>
                      </div>
                      <div className="h-px bg-border my-1" />
                      <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary text-sm transition-colors">
                        <Icon name="Settings" size={18} className="text-muted-foreground" />
                        Настройки
                      </button>
                      <button
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-destructive/10 text-sm text-destructive transition-colors"
                      >
                        <Icon name="LogOut" size={18} />
                        Выйти из аккаунта
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            {/* Search */}
            <div className="relative">
              <Icon name="Search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск чатов и сообщений"
                className="w-full h-11 pl-11 pr-4 rounded-2xl bg-secondary text-sm outline-none focus:ring-2 focus:ring-primary/40 transition-shadow placeholder:text-muted-foreground"
              />
            </div>
          </header>

          {/* Chat list */}
          <div className="flex-1 overflow-y-auto no-scrollbar px-2 pb-24">
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center px-8 py-16 text-muted-foreground">
                <Icon name="MessageCircle" size={40} className="mb-3 opacity-50" />
                <p className="text-sm">Пока нет чатов. Начните новую переписку по кнопке ниже.</p>
              </div>
            )}
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => openChat(c.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl mb-0.5 text-left transition-colors ${
                  activeId === c.id ? 'bg-primary/10' : 'hover:bg-secondary'
                }`}
              >
                <div className="relative shrink-0">
                  <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${colorFor(c.id)} flex items-center justify-center text-white font-semibold text-lg`}>
                    {initialsFor(c.name)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[15px] truncate flex items-center gap-1">
                      {c.name || 'Без имени'}
                    </span>
                    <span className={`text-[12px] shrink-0 ${c.unread ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                      {fmtTime(c.last_time)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-[13.5px] text-muted-foreground truncate">
                      {c.last_sender_id === user.id && c.last_message ? 'Вы: ' : ''}
                      {c.last_message || 'Нет сообщений'}
                    </span>
                    {c.unread > 0 && (
                      <span className="shrink-0 min-w-[22px] h-[22px] px-1.5 rounded-full bg-primary text-primary-foreground text-[12px] font-semibold flex items-center justify-center animate-scale-in">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* FAB */}
          <button
            onClick={() => setNewChatOpen(true)}
            className="absolute bottom-6 right-6 w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-xl shadow-blue-500/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-10"
          >
            <Icon name="Pencil" size={22} />
          </button>

          {/* New chat modal */}
          {newChatOpen && (
            <div className="absolute inset-0 z-40 bg-black/30 flex items-end md:items-center justify-center p-4 animate-fade-in">
              <div className="w-full max-w-sm bg-background rounded-[1.75rem] p-6 shadow-2xl animate-scale-in">
                <h3 className="text-lg font-bold font-display mb-1">Новый чат</h3>
                <p className="text-sm text-muted-foreground mb-4">Введите номер телефона собеседника</p>
                <input
                  autoFocus
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && startNewChat()}
                  placeholder="+7 900 000-00-00"
                  inputMode="tel"
                  className="w-full h-12 px-4 rounded-2xl bg-secondary text-base outline-none focus:ring-2 focus:ring-primary/40 mb-4"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewChatOpen(false)}
                    className="flex-1 h-12 rounded-2xl bg-secondary font-medium text-sm hover:bg-secondary/70 transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={startNewChat}
                    disabled={creatingChat}
                    className="flex-1 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white font-medium text-sm shadow-lg shadow-blue-500/30 disabled:opacity-60"
                  >
                    {creatingChat ? 'Создаём…' : 'Начать чат'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Conversation */}
        <main className={`${active ? 'flex' : 'hidden md:flex'} flex-col flex-1 chat-bg relative`}>
          {active ? (
            <>
              {/* Chat header */}
              <header className="flex items-center gap-3 px-4 py-3 bg-background/80 backdrop-blur-xl border-b border-border z-10">
                <button onClick={() => setActiveId(null)} className="md:hidden w-9 h-9 -ml-1 flex items-center justify-center rounded-full hover:bg-secondary">
                  <Icon name="ArrowLeft" size={22} />
                </button>
                <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${colorFor(active.id)} flex items-center justify-center text-white font-semibold`}>
                  {initialsFor(active.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-[16px] leading-tight truncate">{active.name || 'Без имени'}</h2>
                  <span className="text-[12.5px] text-muted-foreground">
                    {active.type === 'group' ? 'группа' : 'личный чат'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <button className="w-10 h-10 rounded-full hover:bg-secondary flex items-center justify-center transition-colors"><Icon name="Phone" size={20} /></button>
                  <button className="w-10 h-10 rounded-full hover:bg-secondary flex items-center justify-center transition-colors"><Icon name="Video" size={20} /></button>
                  <button className="w-10 h-10 rounded-full hover:bg-secondary flex items-center justify-center transition-colors"><Icon name="Search" size={20} /></button>
                </div>
              </header>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto no-scrollbar px-3 md:px-6 py-4 space-y-1.5">
                <div className="flex justify-center my-3">
                  <span className="text-[12px] text-muted-foreground bg-background/70 backdrop-blur px-3 py-1 rounded-full">Сегодня</span>
                </div>
                {messages.map((m) => {
                  const mine = m.sender_id === user.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[78%] md:max-w-[62%]">
                        {active.type === 'group' && !mine && (
                          <span className="text-[12px] font-medium text-primary ml-3.5">{m.sender_name}</span>
                        )}
                        <div
                          className={`px-3.5 py-2 text-[15px] leading-snug animate-bubble-in shadow-sm ${
                            mine
                              ? 'bg-gradient-to-br from-sky-500 to-blue-600 text-white rounded-3xl rounded-br-md'
                              : 'bg-background text-foreground rounded-3xl rounded-bl-md'
                          }`}
                        >
                          <span>{m.text}</span>
                          <span className={`inline-flex items-center gap-1 ml-2 align-bottom text-[11px] ${mine ? 'text-white/70' : 'text-muted-foreground'}`}>
                            {fmtTime(m.created_at)}
                            {mine && <StatusTicks read={false} />}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              {/* Input bar */}
              <div className="px-3 md:px-4 py-3 bg-background/80 backdrop-blur-xl border-t border-border">
                {recording ? (
                  <div className="flex items-center gap-3 h-12">
                    <button onClick={() => setRecording(false)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-destructive">
                      <Icon name="Trash2" size={20} />
                    </button>
                    <div className="flex-1 flex items-center gap-[3px] h-8">
                      {Array.from({ length: 40 }).map((_, i) => (
                        <span
                          key={i}
                          className="flex-1 bg-primary/70 rounded-full"
                          style={{
                            height: `${20 + Math.abs(Math.sin(i)) * 80}%`,
                            animation: `wave 0.8s ease-in-out ${i * 0.04}s infinite`,
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground tabular-nums">0:04</span>
                    <button onClick={() => setRecording(false)} className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-white flex items-center justify-center shadow-lg">
                      <Icon name="Send" size={20} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <button className="w-11 h-11 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground transition-colors shrink-0">
                      <Icon name="Paperclip" size={22} />
                    </button>
                    <div className="flex-1 flex items-center bg-secondary rounded-3xl px-4 min-h-[44px]">
                      <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && send()}
                        placeholder="Сообщение"
                        className="flex-1 bg-transparent outline-none text-[15px] py-2.5 placeholder:text-muted-foreground"
                      />
                      <button className="text-muted-foreground hover:text-primary transition-colors ml-2">
                        <Icon name="Smile" size={22} />
                      </button>
                    </div>
                    <button
                      onMouseDown={() => !input.trim() && setRecording(true)}
                      onClick={() => input.trim() && send()}
                      className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/40 hover:scale-105 active:scale-95 transition-transform shrink-0"
                    >
                      <Icon name={input.trim() ? 'Send' : 'Mic'} size={20} />
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-2xl shadow-blue-500/30 mb-6 animate-scale-in">
                <Icon name="Send" size={40} className="text-white -rotate-12" />
              </div>
              <h2 className="text-2xl font-extrabold font-display mb-2">Добро пожаловать в Кенко</h2>
              <p className="text-muted-foreground max-w-xs">Выберите чат слева, чтобы начать общение. Быстро, красиво и приватно.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Index;
