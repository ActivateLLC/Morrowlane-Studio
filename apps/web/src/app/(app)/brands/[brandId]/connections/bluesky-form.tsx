'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Label } from '@morrowlane/ui';

/**
 * Bluesky has no redirect flow: a handle and an app password buy a session directly.
 * Errors render inline — a wrong password must never take over the page.
 */
export function BlueskyConnectForm({
  connect,
}: {
  connect: (input: { identifier: string; appPassword: string }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="secondary" size="sm" aria-expanded={open} onClick={() => setOpen(true)}>
        Connect
      </Button>
    );
  }

  return (
    <form
      className="w-full space-y-3 border-t border-line pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setError(null);
          const result = await connect({ identifier, appPassword });
          if (!result.ok) {
            setError(result.error ?? 'Bluesky did not accept those details.');
            return;
          }
          setOpen(false);
          setIdentifier('');
          setAppPassword('');
          router.refresh();
        });
      }}
    >
      {error ? (
        <p role="alert" className="rounded bg-critical-soft px-3 py-2 text-[12px] text-critical">
          {error}
        </p>
      ) : null}
      <div>
        <Label htmlFor="bsky-handle">Bluesky handle</Label>
        <Input
          id="bsky-handle"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="yourbrand.bsky.social"
          autoComplete="username"
          required
        />
      </div>
      <div>
        <Label htmlFor="bsky-app-password">App password</Label>
        <Input
          id="bsky-app-password"
          type="password"
          value={appPassword}
          onChange={(e) => setAppPassword(e.target.value)}
          autoComplete="off"
          required
        />
        <p className="mt-1 text-[11px] text-ink-faint">
          Create one in Bluesky under Settings → Privacy and security → App passwords. It&apos;s not your account
          password, and you can revoke it any time.
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Connecting…' : 'Connect Bluesky'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
