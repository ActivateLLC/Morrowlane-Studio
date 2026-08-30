import { cn } from '@morrowlane/ui';

/** The M monogram from the reference: rounded teal square, white mark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-[15px] font-bold text-white',
        className,
      )}
    >
      M
    </span>
  );
}

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className={cn('text-[15px] font-semibold tracking-tight', dark ? 'text-shell-bright' : 'text-ink')}>
        Morrowlane <span className="font-normal opacity-70">Studio</span>
      </span>
    </span>
  );
}
