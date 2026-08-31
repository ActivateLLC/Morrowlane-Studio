'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@morrowlane/ui';

/**
 * A destructive submit that asks first. Deleting a brand, disconnecting an account and
 * cancelling a post were all one unguarded tap — on a phone, one mis-tap. Two steps
 * inline (rather than window.confirm) keeps the explanation on screen and works the
 * same in every browser; the armed state disarms itself after a few seconds so the
 * page never sits in a half-committed state.
 */
export function ConfirmButton({
  children,
  confirmLabel,
  explanation,
  size = 'sm',
  variant = 'ghost',
  className,
}: {
  children: React.ReactNode;
  /** What the second tap says — name the consequence, e.g. "Delete for good". */
  confirmLabel: string;
  /** One line shown while armed, so the user knows exactly what is about to happen. */
  explanation?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!armed) return;
    timer.current = setTimeout(() => setArmed(false), 6000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [armed]);

  if (!armed) {
    return (
      <Button
        type="button"
        size={size}
        variant={variant}
        className={className}
        onClick={() => setArmed(true)}
        disabled={pending}
      >
        {children}
      </Button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {explanation ? <span className="text-[12px] text-ink-soft">{explanation}</span> : null}
      <Button type="submit" size={size} variant="danger" disabled={pending}>
        {pending ? 'Working…' : confirmLabel}
      </Button>
      <Button type="button" size={size} variant="ghost" onClick={() => setArmed(false)} disabled={pending}>
        Keep it
      </Button>
    </span>
  );
}
