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

  if (checking) return <div className="min-h-screen bg-[#020817] text-slate-300 flex items-center justify-center">Checking secure session...</div>;
  if (session) return <App />;

  return (
    <div className="min-h-screen bg-[#020817] text-slate-200 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950/80 p-6">
        <h1 className="text-xl font-semibold text-white">EGX Portfolio</h1>
        <p className="mt-2 text-sm text-slate-400">Sign in to your private portfolio.</p>
        <input type="email" autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-6 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" required />
        <input type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" required />
        {error && <div className="mt-4 text-sm text-red-300">{error}</div>}
        <button type="submit" disabled={submitting} className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60">
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
