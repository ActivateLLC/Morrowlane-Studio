import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Badge } from '@morrowlane/ui';
import { requireSession } from '@/server/session';
import { BrandSidebar } from './nav';

export default async function BrandLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const session = await requireSession();
  const brand = await session.runtime.store.getBrand(brandId);
  if (!brand || brand.organizationId !== session.organizationId) notFound();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <BrandSidebar brandId={brandId} brandName={brand.name} email={session.user.email} />
      <div className="min-w-0 flex-1">
        {brand.status !== 'ready' ? (
          <div className="border-b border-line bg-surface px-4 py-2 lg:px-6">
            <Badge tone={brand.status === 'failed' ? 'critical' : 'accent'}>
              {brand.statusDetail ?? brand.status}
            </Badge>
          </div>
        ) : null}
        {/* Bottom padding clears the phone tab bar; gone on desktop. */}
        <main className="anim-rise mx-auto max-w-5xl px-4 pb-24 pt-6 lg:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
