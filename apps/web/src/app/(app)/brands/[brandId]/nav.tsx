'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@morrowlane/ui';

const TABS = [
  { slug: '', label: 'Today' },
  { slug: 'studio', label: 'Studio' },
  { slug: 'remix', label: 'Remix' },
  { slug: 'campaigns', label: 'Campaigns' },
  { slug: 'calendar', label: 'Calendar' },
  { slug: 'library', label: 'Library' },
  { slug: 'brain', label: 'Brand Brain' },
  { slug: 'connections', label: 'Connections' },
  { slug: 'intelligence', label: 'Intelligence' },
  { slug: 'analytics', label: 'Analytics' },
];

export function BrandNav({ brandId }: { brandId: string }) {
  const pathname = usePathname();
  const base = `/brands/${brandId}`;

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line pb-px">
      {TABS.map((tab) => {
        const href = tab.slug ? `${base}/${tab.slug}` : base;
        const active = tab.slug ? pathname.startsWith(href) : pathname === base;
        return (
          <Link
            key={tab.slug}
            href={href}
            className={cn(
              'whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium transition-colors',
              active
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-soft hover:border-line hover:text-ink',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
