import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Badge } from '@morrowlane/ui';
import { requireSession } from '@/server/session';
import { BrandNav } from './nav';

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
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/" className="text-[13px] text-ink-faint hover:text-ink">
          Brands
        </Link>
        <span className="text-ink-faint">/</span>
        <span className="text-[15px] font-semibold text-ink">{brand.name}</span>
        {brand.status !== 'ready' ? (
          <Badge tone={brand.status === 'failed' ? 'critical' : 'accent'}>
            {brand.statusDetail ?? brand.status}
          </Badge>
        ) : null}
      </div>
      <BrandNav brandId={brandId} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
