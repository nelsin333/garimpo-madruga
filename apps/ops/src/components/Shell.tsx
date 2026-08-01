'use client';

import type { Session } from '@supabase/supabase-js';
import Link from 'next/link';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

interface ShellContextValue {
  session: Session;
  role: 'expert' | 'admin';
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const value = useContext(ShellContext);
  if (!value) throw new Error('useShell fora do Shell');
  return value;
}

/** Autenticação + autorização (expert/admin) + navegação do painel. */
export function Shell({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = supabase();
    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = client.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setRole(null);
      return;
    }
    supabase()
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setRole(data?.role ?? 'user'));
  }, [session]);

  if (loading) return <div className="center muted">Carregando…</div>;
  if (!session) return <Login />;
  if (role === null) return <div className="center muted">Verificando acesso…</div>;
  if (role !== 'expert' && role !== 'admin') {
    return (
      <div className="center">
        <div className="card login">
          <h1>Sem acesso</h1>
          <p className="muted">
            Sua conta ({session.user.email}) não tem papel de especialista. Peça a um admin para
            promover seu perfil.
          </p>
          <button className="secondary" onClick={() => void supabase().auth.signOut()}>
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <ShellContext.Provider value={{ session, role }}>
      <header className="topbar">
        <nav>
          <Link className="brand" href="/">
            garimpo ops
          </Link>
          <Link href="/">Dashboard</Link>
          <Link href="/references">Referências</Link>
          <Link href="/references/new">+ Nova peça</Link>
        </nav>
        <button className="secondary" onClick={() => void supabase().auth.signOut()}>
          Sair
        </button>
      </header>
      <main>{children}</main>
    </ShellContext.Provider>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { error: authError } = await supabase().auth.signInWithPassword({ email, password });
    setPending(false);
    if (authError) setError('E-mail ou senha inválidos.');
  }

  return (
    <div className="center">
      <form className="card login" onSubmit={handleSubmit}>
        <h1>garimpo ops</h1>
        <p className="muted">Banco de referências — acesso restrito.</p>
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error ? <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p> : null}
        <div style={{ marginTop: 16 }}>
          <button type="submit" disabled={pending} style={{ width: '100%' }}>
            {pending ? 'Entrando…' : 'Entrar'}
          </button>
        </div>
      </form>
    </div>
  );
}
