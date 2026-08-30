import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Button } from '@morrowlane/ui';
import { signOut } from '@/server/actions';
import { getSessionUser } from '@/server/session';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in');

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="text-[15px] font-semibold tracking-tight text-ink">
            Morrowlane <span className="text-accent">Studio</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-[13px] text-ink-faint sm:block">{user.email}</span>
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
