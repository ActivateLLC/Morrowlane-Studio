'use client';

/**
 * Last-resort boundary: catches errors thrown by the root layout itself, where the normal
 * error boundary cannot render. It must supply its own <html>/<body>, and it cannot rely
 * on app styles loading, so the few styles it needs are inline.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0c1512', color: '#e8f1ed', fontFamily: 'system-ui, sans-serif' }}>
        <main
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: '28rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Morrowlane hit an unexpected error</h1>
            <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#93a8a0', lineHeight: 1.6 }}>
              The page could not be loaded. Trying again usually resolves it.
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: '1.5rem',
                background: '#0d9488',
                color: '#fff',
                border: 0,
                borderRadius: '0.5rem',
                padding: '0.65rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            {error.digest ? (
              <p style={{ marginTop: '1rem', fontSize: '0.6875rem', color: '#6b7a74' }}>Reference: {error.digest}</p>
            ) : null}
          </div>
        </main>
      </body>
    </html>
  );
}
