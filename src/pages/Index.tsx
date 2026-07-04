import { useState, useRef, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/context/AuthContext';
import AuthScreen from '@/components/AuthScreen';

type Msg = {
  id: number;
  text: string;
  mine: boolean;
  time: string;
  status?: 'sent' | 'delivered' | 'read';
};

type Chat = {
  id: number;
  name: string;
  avatar: string;
  color: string;
  last: string;
  time: string;
  unread: number;
  online: boolean;
  pinned?: boolean;
  messages: Msg[];
};

const initialChats: Chat[] = [
  {
    id: 1,
    name: 'Аня Морозова',
    avatar: 'АМ',
    color: 'from-sky-400 to-blue-500',
    last: 'Отправила фото с прогулки 🌸',
    time: '14:32',
    unread: 3,
    online: true,
    pinned: true,
    messages: [
      { id: 1, text: 'Привет! Как ты?', mine: false, time: '14:20' },
      { id: 2, text: 'Привет! Всё супер, работаю над новым проектом 🚀', mine: true, time: '14:22', status: 'read' },
      { id: 3, text: 'Звучит здорово! Расскажешь подробнее?', mine: false, time: '14:25' },
      { id: 4, text: 'Конечно, это мессенджер Кенко ✨', mine: true, time: '14:26', status: 'read' },
      { id: 5, text: 'Отправила фото с прогулки 🌸', mine: false, time: '14:32' },
    ],
  },
  {
    id: 2,
    name: 'Команда Кенко',
    avatar: 'КК',
    color: 'from-cyan-400 to-sky-500',
    last: 'Максим: запускаем в пятницу!',
    time: '13:10',
    unread: 12,
    online: false,
    messages: [
      { id: 1, text: 'Всем привет! Как продвигается?', mine: false, time: '12:50' },
      { id: 2, text: 'Почти готово, финальные штрихи 👌', mine: true, time: '13:05', status: 'delivered' },
      { id: 3, text: 'Максим: запускаем в пятницу!', mine: false, time: '13:10' },
    ],
  },
  {
    id: 3,
    name: 'Дмитрий Волков',
    avatar: 'ДВ',
    color: 'from-blue-400 to-indigo-500',
    last: 'Ты: договорились 👍',
    time: 'Вчера',
    unread: 0,
    online: true,
    messages: [
      { id: 1, text: 'Встречаемся завтра в 10?', mine: false, time: '18:00' },
      { id: 2, text: 'договорились 👍', mine: true, time: '18:02', status: 'read' },
    ],
  },
  {
    id: 4,
    name: 'Мама',
    avatar: 'М',
    color: 'from-pink-400 to-rose-500',
    last: 'Не забудь поесть 🍲',
    time: 'Вчера',
    unread: 1,
    online: false,
    messages: [
      { id: 1, text: 'Как дела, солнышко?', mine: false, time: '19:00' },
      { id: 2, text: 'Не забудь поесть 🍲', mine: false, time: '19:01' },
    ],
  },
  {
    id: 5,
    name: 'Спортзал',
    avatar: 'СЗ',
    color: 'from-emerald-400 to-teal-500',
    last: 'Тренировка перенесена на 19:00',
    time: 'Пн',
    unread: 0,
    online: false,
    messages: [
      { id: 1, text: 'Тренировка перенесена на 19:00', mine: false, time: '11:00' },
    ],
  },
];

const StatusTicks = ({ status }: { status?: Msg['status'] }) => {
  if (!status) return null;
  if (status === 'sent') return <Icon name="Check" size={15} className="text-white/70" />;
  return (
    <span className="relative inline-flex w-[19px]">
      <Icon name="Check" size={15} className={status === 'read' ? 'text-sky-200' : 'text-white/70'} />
      <Icon name="Check" size={15} className={`-ml-[9px] ${status === 'read' ? 'text-sky-200' : 'text-white/70'}`} />
    </span>
  );
};

const Index = () => {
  const { user, loading, logout } = useAuth();
  const [chats, setChats] = useState(initialChats);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [input, setInput] = useState('');
  const [recording, setRecording] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const active = chats.find((c) => c.id === activeId) || null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active?.messages.length, activeId]);

  const openChat = (id: number) => {
    setActiveId(id);
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  };

  const send = () => {
    if (!input.trim() || !active) return;
    const now = new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    const newMsg: Msg = { id: Date.now(), text: input, mine: true, time: now, status: 'sent' };
    setChats((prev) =>
      prev.map((c) =>
        c.id === active.id
          ? { ...c, messages: [...c.messages, newMsg], last: 'Ты: ' + input, time: now }
          : c
      )
    );
    setInput('');
  };

  const filtered = chats.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
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

  const initials = (user.name || 'Я')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="h-[100dvh] w-full bg-secondary flex justify-center overflow-hidden font-sans">
      <div className="w-full max-w-[1400px] h-full flex bg-background md:my-0 shadow-2xl md:shadow-none">
        {/* Sidebar / Chat list */}
        <aside
          className={`${
            active ? 'hidden md:flex' : 'flex'
          } flex-col w-full md:w-[380px] lg:w-[420px] border-r border-border bg-background shrink-0`}
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
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => openChat(c.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl mb-0.5 text-left transition-colors ${
                  activeId === c.id ? 'bg-primary/10' : 'hover:bg-secondary'
                }`}
              >
                <div className="relative shrink-0">
                  <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${c.color} flex items-center justify-center text-white font-semibold text-lg`}>
                    {c.avatar}
                  </div>
                  {c.online && (
                    <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-background" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[15px] truncate flex items-center gap-1">
                      {c.pinned && <Icon name="Pin" size={13} className="text-muted-foreground rotate-45" />}
                      {c.name}
                    </span>
                    <span className={`text-[12px] shrink-0 ${c.unread ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                      {c.time}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-[13.5px] text-muted-foreground truncate">{c.last}</span>
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
          <button className="absolute md:relative bottom-6 right-6 md:bottom-0 md:right-0 md:self-end md:m-5 w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-xl shadow-blue-500/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-10">
            <Icon name="Pencil" size={22} />
          </button>
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
                <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${active.color} flex items-center justify-center text-white font-semibold`}>
                  {active.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-[16px] leading-tight truncate">{active.name}</h2>
                  <span className={`text-[12.5px] ${active.online ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                    {active.online ? 'в сети' : 'был(а) недавно'}
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
                {active.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[78%] md:max-w-[62%] px-3.5 py-2 text-[15px] leading-snug animate-bubble-in shadow-sm ${
                        m.mine
                          ? 'bg-gradient-to-br from-sky-500 to-blue-600 text-white rounded-3xl rounded-br-md'
                          : 'bg-background text-foreground rounded-3xl rounded-bl-md'
                      }`}
                    >
                      <span>{m.text}</span>
                      <span className={`inline-flex items-center gap-1 ml-2 align-bottom text-[11px] ${m.mine ? 'text-white/70' : 'text-muted-foreground'}`}>
                        {m.time}
                        {m.mine && <StatusTicks status={m.status} />}
                      </span>
                    </div>
                  </div>
                ))}
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