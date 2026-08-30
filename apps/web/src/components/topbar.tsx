import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@morrowlane/ui';
import { signOut } from '@/server/actions';
import { Logo } from './logo';

/** Slim white top bar for pages outside a brand workspace. */
export function TopBarPage({ email, children }: { email: string; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-[13px] text-ink-faint sm:block">{email}</span>
            <Link href="/settings" className="text-[13px] text-ink-soft hover:text-ink">
              Settings
            </Link>
            <form action={signOut}>
              <Button variant="ghost" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
