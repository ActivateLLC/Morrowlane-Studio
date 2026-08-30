'use client';

import { ErrorState } from '@/components/error-state';

export default function BrandError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState {...props} />;
}
