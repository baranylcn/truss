import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, isPasswordRecoveryLink } from '../lib/supabase';
import { authApi } from '../services/api/auth';

const AUTH_PROVIDER = import.meta.env.VITE_AUTH_PROVIDER ?? 'local';
const LOCAL_TOKEN_KEY = 'truss_token';
const LOCAL_USER_KEY = 'truss_user';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';

interface User {
  id: string;
  email: string;
  user_metadata?: { full_name?: string };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  recoveryMode: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  exitRecovery: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);


// Local auth helpers

async function localRegister(email: string, password: string, fullName: string): Promise<User> {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, full_name: fullName }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail ?? `Registration failed (${res.status})`);
  }
  const data = await res.json();
  const user: User = { id: data.user_id, email: data.email };
  localStorage.setItem(LOCAL_TOKEN_KEY, data.access_token);
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
  return user;
}

async function localLogin(email: string, password: string): Promise<User> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail ?? `Login failed (${res.status})`);
  }
  const data = await res.json();
  const user: User = { id: data.user_id, email: data.email };
  localStorage.setItem(LOCAL_TOKEN_KEY, data.access_token);
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
  return user;
}

function localSignOut(): void {
  localStorage.removeItem(LOCAL_TOKEN_KEY);
  localStorage.removeItem(LOCAL_USER_KEY);
}

function localGetUser(): User | null {
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}


// Provider

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(
    AUTH_PROVIDER === 'supabase' && isPasswordRecoveryLink,
  );

  useEffect(() => {
    if (AUTH_PROVIDER === 'local') {
      setUser(localGetUser());
      setLoading(false);
      return;
    }

    // Supabase path
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email!,
          user_metadata: session.user.user_metadata,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    }).catch(() => {
      setUser(null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
      }
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email!,
          user_metadata: session.user.user_metadata,
        });
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          authApi.sync().catch(() => {});
        }
      } else {
        setUser(null);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    if (AUTH_PROVIDER === 'local') {
      const u = await localRegister(email, password, fullName);
      setUser(u);
      return;
    }
    if (!supabase) throw new Error('Supabase is not configured');
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    if (AUTH_PROVIDER === 'local') {
      const u = await localLogin(email, password);
      setUser(u);
      return;
    }
    if (!supabase) throw new Error('Supabase is not configured');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    if (AUTH_PROVIDER === 'local') {
      localSignOut();
      setUser(null);
      return;
    }
    if (!supabase) throw new Error('Supabase is not configured');
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    if (AUTH_PROVIDER === 'local') {
      throw new Error('Password reset is not available in local auth mode.');
    }
    if (!supabase) throw new Error('Supabase is not configured');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string) => {
    if (AUTH_PROVIDER === 'local') {
      throw new Error('Password change is not available in local auth mode.');
    }
    if (!supabase) throw new Error('Supabase is not configured');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  const exitRecovery = () => {
    setRecoveryMode(false);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/');
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, recoveryMode, signUp, signIn, signOut, resetPassword, updatePassword, exitRecovery }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
