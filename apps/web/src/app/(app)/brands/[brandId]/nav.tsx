'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@morrowlane/ui';
import { Icon } from '@/components/icons';
import { LogoMark } from '@/components/logo';

const ITEMS = [
  { slug: '', label: 'Today', icon: 'home' },
  { slug: 'plan', label: 'Plan', icon: 'rocket' },
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

/** The five tabs a phone thumb actually needs; the rest live behind Menu. */
const MOBILE_TABS = ['', 'plan', 'calendar', 'library'];

function NavList({
  brandId,
  pathname,
  onNavigate,
  itemClassName,
}: {
  brandId: string;
  pathname: string;
  onNavigate?: () => void;
  itemClassName?: string;
}) {
  const base = `/brands/${brandId}`;
  return (
    <>
      {ITEMS.map((item) => {
        const href = item.slug ? `${base}/${item.slug}` : base;
        const active = item.slug ? pathname.startsWith(href) : pathname === base;
        return (
          <Link
            key={item.slug}
            href={href}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors',
              itemClassName ?? 'py-2',
              active
                ? 'bg-shell-raised text-shell-bright'
                : 'text-shell-text hover:bg-shell-hover hover:text-shell-bright',
            )}
          >
            <Icon name={item.icon} className={cn('h-4 w-4 shrink-0', active ? 'text-accent-strong' : 'text-shell-text')} />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

/**
 * Navigation for a brand workspace, mobile-first:
 * - phones get a sticky top bar, a bottom tab bar for the everyday screens, and a
 *   full drawer for everything else;
 * - lg and up gets the dark pine sidebar from the reference.
 */
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
  const [open, setOpen] = useState(false);
  const base = `/brands/${brandId}`;

  // A route change means the user got where they were going; the drawer's job is done.
  useEffect(() => setOpen(false), [pathname]);
  // The drawer overlays the page; the page must not scroll underneath it.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);


  const drawerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    triggerRef.current = document.activeElement as HTMLElement | null;
    const node = drawerRef.current;
    const focusable = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [],
      );
    focusable()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      // Keep Tab inside the overlay rather than letting it reach the hidden page.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      {/* ------------------------------- Phone ------------------------------- */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-shell pl-4 pr-2 lg:hidden">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <LogoMark />
          <span className="truncate text-[14px] font-semibold text-shell-bright">{brandName}</span>
        </Link>
        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-shell-bright"
        >
          {open ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </header>

      {open ? (
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Workspace sections"
          className="anim-drawer fixed inset-0 top-14 z-30 flex flex-col bg-shell lg:hidden"
        >
          <nav aria-label="Sections" className="flex-1 space-y-0.5 overflow-y-auto px-3 pt-2">
            <NavList brandId={brandId} pathname={pathname} onNavigate={() => setOpen(false)} itemClassName="py-3 text-[15px]" />
          </nav>
          <div className="space-y-0.5 border-t border-shell-line px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Link
              href="/settings"
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-3 text-[15px] font-medium text-shell-text"
            >
              <Icon name="gear" className="h-4 w-4" />
              Settings
            </Link>
            <p className="truncate px-2.5 text-[12px] text-shell-text/70">{email}</p>
          </div>
        </div>
      ) : null}

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-20 flex border-t border-shell-line bg-shell pb-[env(safe-area-inset-bottom)] lg:hidden">
        {ITEMS.filter((item) => MOBILE_TABS.includes(item.slug)).map((item) => {
          const href = item.slug ? `${base}/${item.slug}` : base;
          const active = item.slug ? pathname.startsWith(href) : pathname === base;
          return (
            <Link
              key={item.slug}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium',
                active ? 'text-accent-strong' : 'text-shell-text',
              )}
            >
              <Icon name={item.icon} className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={cn(
            'flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium',
            open ? 'text-accent-strong' : 'text-shell-text',
          )}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
            <circle cx="5" cy="12" r="1.6" fill="currentColor" />
            <circle cx="12" cy="12" r="1.6" fill="currentColor" />
            <circle cx="19" cy="12" r="1.6" fill="currentColor" />
          </svg>
          More
        </button>
      </nav>

      {/* ------------------------------ Desktop ------------------------------ */}
      <aside className="sticky top-0 hidden h-screen w-[15rem] shrink-0 flex-col bg-shell lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-5 pb-5 pt-6">
          <LogoMark />
          <span className="text-[14px] font-semibold tracking-tight text-shell-bright">
            Morrowlane <span className="font-normal text-shell-text">Studio</span>
          </span>
        </Link>

        <p className="px-5 pb-2 text-[11px] font-medium uppercase tracking-wider text-shell-text/70">
          {brandName}
        </p>

        <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3">
          <NavList brandId={brandId} pathname={pathname} />
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
    </>
  );
}
