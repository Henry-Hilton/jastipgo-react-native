import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError, request, restoreSession, saveSession, type Role, type Session } from './api';

type SessionContext = {
  session: Session | null;
  ready: boolean;
  call: <T>(action: string, data?: object) => Promise<T>;
  authenticate: (register: boolean, data: object) => Promise<void>;
  changeRole: (role: Role) => Promise<void>;
  logout: () => Promise<void>;
};

const Context = createContext<SessionContext | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const current = useRef<Session | null>(null);

  useEffect(() => {
    restoreSession().then(saved => { current.current = saved; setSession(saved); })
      .catch(() => {}).finally(() => setReady(true));
  }, []);

  const update = useCallback(async (next: Session | null) => {
    current.current = next;
    setSession(next);
    await saveSession(next);
  }, []);

  const call = useCallback(async <T,>(action: string, data?: object) => {
    const active = current.current;
    try {
      return await request<T>(active, action, data);
    } catch (error) {
      if (active && current.current?.token === active.token && error instanceof ApiError && error.status === 401) {
        await update(null);
      }
      throw error;
    }
  }, [update]);

  async function authenticate(register: boolean, data: object) {
    const result = await request<Omit<Session, 'role'>>(null, register ? 'register' : 'login', data);
    await update({ ...result, role: 'penitip' });
  }

  async function changeRole(role: Role) {
    if (current.current) await update({ ...current.current, role });
  }

  async function logout() {
    try { await call('logout'); } finally { await update(null); }
  }

  return <Context.Provider value={{ session, ready, call, authenticate, changeRole, logout }}>{children}</Context.Provider>;
}

export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error('SessionProvider is required');
  return value;
}
