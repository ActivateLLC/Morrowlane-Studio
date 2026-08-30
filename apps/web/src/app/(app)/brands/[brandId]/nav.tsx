'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@morrowlane/ui';
import { Icon } from '@/components/icons';
import { LogoMark } from '@/components/logo';

const ITEMS = [
  { slug: '', label: 'Today', icon: 'home' },
  { slug: 'studio', label: 'Studio', icon: 'sparkle' },
  { slug: 'remix', label: 'Remix', icon: 'link' },
  { slug: 'campaigns', label: 'Campaigns', icon: 'flag' },
  { slug: 'calendar', label: 'Calendar', icon: 'calendar' },
  { slug: 'library', label: 'Library', icon: 'stack' },
  { slug: 'brain', label: 'Brand Brain', icon: 'brain' },
  { slug: 'connections', label: 'Connections', icon: 'plug' },
  { slug: 'intelligence', label: 'Intelligence', icon: 'radar' },
  { slug: 'analytics', label: 'Analytics', icon: 'chart' },
];

/** The dark pine sidebar from the reference. */
export function BrandSidebar({
  brandId,
  brandName,
  email,
}: {
  brandId: string;
  brandName: string;
  email: string;
}) {
  const pathname = usePathname();
  const base = `/brands/${brandId}`;

  return (
    <aside className="sticky top-0 flex h-screen w-[15rem] shrink-0 flex-col bg-shell">
      <Link href="/" className="flex items-center gap-2.5 px-5 pb-5 pt-6">
        <LogoMark />
        <span className="text-[14px] font-semibold tracking-tight text-shell-bright">
          Morrowlane <span className="font-normal text-shell-text">Studio</span>
        </span>
      </Link>

      <p className="px-5 pb-2 text-[11px] font-medium uppercase tracking-wider text-shell-text/70">
        {brandName}
      </p>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {ITEMS.map((item) => {
          const href = item.slug ? `${base}/${item.slug}` : base;
          const active = item.slug ? pathname.startsWith(href) : pathname === base;
          return (
            <Link
              key={item.slug}
              href={href}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                active
                  ? 'bg-shell-raised text-shell-bright'
                  : 'text-shell-text hover:bg-shell-hover hover:text-shell-bright',
              )}
            >
              <Icon name={item.icon} className={cn('h-4 w-4', active ? 'text-accent' : 'text-shell-text')} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-0.5 border-t border-shell-line px-3 py-3">
        <Link
          href="/settings"
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-shell-text transition-colors hover:bg-shell-hover hover:text-shell-bright"
        >
          <Icon name="gear" className="h-4 w-4" />
          Settings
        </Link>
        <p className="truncate px-2.5 pb-1 pt-1.5 text-[11px] text-shell-text/70">{email}</p>
      </div>
    </aside>
  );
}
