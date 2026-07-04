import { useState, useRef, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { authApi } from '@/lib/authApi';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/hooks/use-toast';

type Step = 'phone' | 'code' | 'profile';

const AuthScreen = () => {
  const { setUser } = useAuth();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('+7');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('в сети');
  const [loading, setLoading] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
  }, [step]);

  const sendCode = async () => {
    if (phone.replace(/\D/g, '').length < 11) {
      toast({ title: 'Введите корректный номер' });
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.sendCode(phone);
      setStep('code');
      toast({
        title: 'Код отправлен',
        description: `Демо-код: ${res.demo_code}`,
      });
    } catch (e) {
      toast({ title: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    if (code.length < 6) return;
    setLoading(true);
    try {
      const res = await authApi.verifyCode(phone, code);
      localStorage.setItem('kenko_token', res.token);
      if (res.is_new) {
        setStep('profile');
      } else {
        setUser(res.user);
      }
    } catch (e) {
      toast({ title: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!name.trim()) {
      toast({ title: 'Введите имя' });
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.updateProfile(name, status);
      setUser(res.user);
    } catch (e) {
      toast({ title: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] w-full flex items-center justify-center bg-secondary chat-bg px-5">
      <div className="w-full max-w-[400px] bg-background rounded-[2rem] shadow-2xl shadow-blue-500/10 p-8 animate-scale-in">
        <div className="flex flex-col items-center mb-7">
          <div className="w-20 h-20 rounded-[1.6rem] bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-xl shadow-blue-500/30 mb-4">
            <Icon name="Send" size={34} className="text-white -rotate-12" />
          </div>
          <h1 className="text-2xl font-extrabold font-display tracking-tight">Кенко</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {step === 'phone' && 'Введите номер телефона'}
            {step === 'code' && 'Введите код из SMS'}
            {step === 'profile' && 'Расскажите о себе'}
          </p>
        </div>

        {step === 'phone' && (
          <div className="space-y-4 animate-fade-in">
            <div className="relative">
              <Icon name="Phone" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendCode()}
                placeholder="+7 900 000-00-00"
                inputMode="tel"
                className="w-full h-14 pl-12 pr-4 rounded-2xl bg-secondary text-lg outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <button
              onClick={sendCode}
              disabled={loading}
              className="w-full h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white font-semibold text-base shadow-lg shadow-blue-500/30 hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-60"
            >
              {loading ? 'Отправляем…' : 'Получить код'}
            </button>
            <p className="text-[12px] text-muted-foreground text-center leading-relaxed">
              Нажимая «Получить код», вы соглашаетесь с условиями использования Кенко
            </p>
          </div>
        )}

        {step === 'code' && (
          <div className="space-y-4 animate-fade-in">
            <input
              ref={codeRef}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && verify()}
              placeholder="______"
              inputMode="numeric"
              className="w-full h-16 text-center text-3xl tracking-[0.5em] font-semibold rounded-2xl bg-secondary outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={verify}
              disabled={loading || code.length < 6}
              className="w-full h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white font-semibold text-base shadow-lg shadow-blue-500/30 hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-50"
            >
              {loading ? 'Проверяем…' : 'Подтвердить'}
            </button>
            <button
              onClick={() => setStep('phone')}
              className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Изменить номер
            </button>
          </div>
        )}

        {step === 'profile' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white text-3xl font-semibold">
                {name.trim() ? name.trim()[0].toUpperCase() : <Icon name="User" size={36} />}
              </div>
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ваше имя"
              className="w-full h-14 px-4 rounded-2xl bg-secondary text-base outline-none focus:ring-2 focus:ring-primary/40"
            />
            <input
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="Статус"
              className="w-full h-12 px-4 rounded-2xl bg-secondary text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={saveProfile}
              disabled={loading}
              className="w-full h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white font-semibold text-base shadow-lg shadow-blue-500/30 hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-60"
            >
              {loading ? 'Сохраняем…' : 'Начать общение'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthScreen;
