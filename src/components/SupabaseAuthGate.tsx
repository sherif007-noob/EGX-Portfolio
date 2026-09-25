import React, { FormEvent, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import App from '../App';
import { getSupabaseBrowserClient } from '../services/supabaseBrowser';

export function SupabaseAuthGate() {
  const supabase = getSupabaseBrowserClient();
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setChecking(false);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) setError(signInError.message);
    setSubmitting(false);
  };

  if (checking) return <div className="premium-page min-h-[100dvh] overflow-y-auto text-slate-300 flex items-center justify-center px-4 py-4 sm:py-6"><div className="premium-glass my-auto rounded-2xl px-5 py-4 text-sm">Checking secure session...</div></div>;
  if (session) return <App />;

  return (
    <div className="premium-page min-h-[100dvh] overflow-y-auto text-slate-200 flex items-center justify-center px-4 py-4 sm:py-6">
      <form onSubmit={handleSubmit} className="premium-glass my-auto w-full min-w-0 max-w-sm rounded-2xl p-5 sm:p-6">
        <h1 className="text-xl font-semibold text-white">EGX Portfolio</h1>
        <p className="mt-2 text-sm text-slate-400">Sign in to your private portfolio.</p>
        <input type="email" autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="premium-field mt-6 w-full rounded-xl px-3 py-2 text-base text-white sm:text-sm" required />
        <input type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="premium-field mt-3 w-full rounded-xl px-3 py-2 text-base text-white sm:text-sm" required />
        {error && <div className="premium-inset-glass premium-state-loss mt-4 break-words rounded-xl px-3 py-2 text-sm text-rose-300">{error}</div>}
        <button type="submit" disabled={submitting} className="premium-action premium-action-primary mt-6 w-full rounded-xl px-4 py-2 font-semibold disabled:opacity-60">
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
