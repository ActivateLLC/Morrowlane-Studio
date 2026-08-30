import Link from 'next/link';

/**
 * Branded 404. Reachable in normal use — the brand workspace calls notFound() when an
 * id does not belong to the caller's organization — so it offers a way back rather than
 * dead-ending on Next's default page.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-shell px-4">
      <div className="w-full max-w-md text-center">
        <p className="text-[13px] font-medium uppercase tracking-wide text-shell-text">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-shell-bright">
          We couldn&apos;t find that page
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-shell-text">
          The link may be out of date, or the workspace it belongs to isn&apos;t yours.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-strong"
        >
          Back to Morrowlane
        </Link>
      </div>
    </main>
  );
}
