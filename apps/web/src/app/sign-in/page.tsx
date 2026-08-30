import { redirect } from 'next/navigation';
import { Button } from '@morrowlane/ui';
import { startDemoSession } from '@/server/actions';
import { getSessionUser, supabaseConfigured } from '@/server/session';
import { LogoMark } from '@/components/logo';
import { SupabaseSignIn } from './supabase-form';

export default async function SignInPage() {
  const user = await getSessionUser();
  if (user) redirect('/');

  return (
    <main className="flex min-h-screen items-center justify-center bg-shell px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-2.5">
            <LogoMark className="h-9 w-9 rounded-xl text-lg" />
            <span className="text-xl font-semibold tracking-tight text-shell-bright">
              Morrowlane <span className="font-normal text-shell-text">Studio</span>
            </span>
          </span>
          <p className="mt-2 text-sm text-shell-text">Turn your business into a content engine.</p>
        </div>
        <div className="rounded-2xl border border-shell-line bg-white p-6 shadow-lifted">
          {supabaseConfigured() ? (
            <SupabaseSignIn />
          ) : (
            <form action={startDemoSession} className="space-y-4">
              <p className="text-sm text-ink-soft">
                This deployment is running without Supabase configured, so Morrowlane opens a local demo
                workspace: a brand already analysed from its website, a month of content on the calendar,
                and performance history for the learning loop to work with.
              </p>
              <Button type="submit" className="w-full">
                Open the demo workspace
              </Button>
              <p className="text-center text-[12px] text-ink-faint">
                Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable real accounts.
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
