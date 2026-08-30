'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Alert, Button, Input, Label } from '@morrowlane/ui';

type Mode = 'sign_in' | 'sign_up' | 'reset';

/** Email/password auth against Supabase, with account creation and password reset. */
export function SupabaseSignIn() {
  const [mode, setMode] = useState<Mode>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const client = createBrowserClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === 'reset') {
        const { error: resetError } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/sign-in`,
        });
        if (resetError) throw resetError;
        setNotice('Check your inbox for a reset link.');
        return;
      }

      const { error: authError } =
        mode === 'sign_up'
          ? await client.auth.signUp({ email, password })
          : await client.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      if (mode === 'sign_up') {
        setNotice('Account created. If confirmation is on, check your inbox; otherwise sign in.');
        setMode('sign_in');
        return;
      }
      window.location.href = '/';
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <Alert tone="critical" title={error} /> : null}
      {notice ? <Alert tone="positive" title={notice} /> : null}

      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      {mode !== 'reset' ? (
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      ) : null}

      <Button type="submit" disabled={busy} className="w-full">
        {mode === 'sign_in' ? 'Sign in' : mode === 'sign_up' ? 'Create account' : 'Send reset link'}
      </Button>

      <div className="flex justify-between text-[13px] text-ink-soft">
        {mode === 'sign_in' ? (
          <>
            <button type="button" className="hover:text-ink" onClick={() => setMode('sign_up')}>
              Create an account
            </button>
            <button type="button" className="hover:text-ink" onClick={() => setMode('reset')}>
              Forgot password?
            </button>
          </>
        ) : (
          <button type="button" className="hover:text-ink" onClick={() => setMode('sign_in')}>
            Back to sign in
          </button>
        )}
      </div>
    </form>
  );
}
