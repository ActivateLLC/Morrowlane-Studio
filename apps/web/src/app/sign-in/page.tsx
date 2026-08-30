import { redirect } from 'next/navigation';
import { Button, Card, CardBody } from '@morrowlane/ui';
import { startDemoSession } from '@/server/actions';
import { getSessionUser, supabaseConfigured } from '@/server/session';
import { SupabaseSignIn } from './supabase-form';

export default async function SignInPage() {
  const user = await getSessionUser();
  if (user) redirect('/');

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-2xl font-semibold tracking-tight text-ink">Morrowlane Studio</p>
          <p className="mt-1 text-sm text-ink-soft">Turn your business into a content engine.</p>
        </div>
        <Card>
          <CardBody className="py-6">
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
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
