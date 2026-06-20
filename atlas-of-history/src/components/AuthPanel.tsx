import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthPanelProps {
  user: User | null;
}

export function AuthPanel({ user }: AuthPanelProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('sending');
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    if (error) {
      setErrorMsg(error.message);
      setStatus('error');
    } else {
      setStatus('sent');
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (user) {
    return (
      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
        <span className="truncate">{user.email}</span>
        <button
          onClick={handleSignOut}
          className="shrink-0 text-slate-500 hover:text-slate-200 underline underline-offset-2"
        >
          Sign out
        </button>
      </div>
    );
  }

  if (status === 'sent') {
    return (
      <p className="text-xs text-green-400">
        Magic link sent — check your email.
      </p>
    );
  }

  return (
    <form onSubmit={handleSendLink} className="space-y-2">
      <input
        type="email"
        required
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
      />
      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium py-1.5 rounded transition-colors"
      >
        {status === 'sending' ? 'Sending…' : 'Send magic link'}
      </button>
      {status === 'error' && (
        <p className="text-xs text-red-400">{errorMsg}</p>
      )}
    </form>
  );
}
