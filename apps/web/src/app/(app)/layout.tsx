import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getSessionUser } from '@/server/session';

/**
 * Auth guard only. The chrome differs by area: brand workspaces render the dark
 * sidebar shell; the brand list and settings render the slim top bar.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in');
  return <>{children}</>;
}
