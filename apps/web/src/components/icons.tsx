/** Minimal stroke icons for the sidebar. One path each, 24-unit grid. */
const PATHS: Record<string, string> = {
  home: 'M4 11.5 12 5l8 6.5M6 10.5V19h4v-5h4v5h4v-8.5',
  sparkle: 'M12 4l1.7 4.6L18 10l-4.3 1.4L12 16l-1.7-4.6L6 10l4.3-1.4L12 4Zm6.5 9.5.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z',
  link: 'M9.5 14.5 14.5 9.5M8 12l-2.2 2.2a3.5 3.5 0 0 0 5 5L13 17m-2-10 2.2-2.2a3.5 3.5 0 0 1 5 5L16 12',
  flag: 'M6 21V4m0 1h11.5l-2.5 3.5L17.5 12H6',
  calendar: 'M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm3-2v4m8-4v4M4 11h16',
  stack: 'M4 7.5 12 4l8 3.5-8 3.5-8-3.5Zm0 4.5 8 3.5L20 12M4 16l8 3.5 8-3.5',
  brain: 'M12 5a3.5 3.5 0 0 1 3.5 3.5v0A3.5 3.5 0 0 1 19 12a3.5 3.5 0 0 1-3.5 3.5A3.5 3.5 0 0 1 12 19a3.5 3.5 0 0 1-3.5-3.5A3.5 3.5 0 0 1 5 12a3.5 3.5 0 0 1 3.5-3.5A3.5 3.5 0 0 1 12 5Zm0 0v14',
  plug: 'M9 4v5m6-5v5M7 9h10v3a5 5 0 0 1-5 5v0a5 5 0 0 1-5-5V9Zm5 8v3',
  radar: 'M12 12 18 6m2 6a8 8 0 1 1-4-6.9M12 12m3 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  chart: 'M5 20V10m5.5 10V4M16 20v-7m4.5 7h-17',
  gear: 'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm7.5 3-1.9-.6.2-2-1.7-1.2-1.7 1.1-1.8-.8L12 4l-.6 1.5-1.8.8-1.7-1.1L6.2 6.4l.2 2-1.9.6.6 2-.6 2 1.9.6-.2 2 1.7 1.2 1.7-1.1 1.8.8L12 20l.6-1.5 1.8-.8 1.7 1.1 1.7-1.2-.2-2 1.9-.6-.6-2 .6-2Z',
  globe: 'M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm-8 8h16M12 4c2.5 2.2 3.5 5 3.5 8s-1 5.8-3.5 8c-2.5-2.2-3.5-5-3.5-8s1-5.8 3.5-8Z',
  exit: 'M14 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8m2-4 4-3-4-3m4 3H10',
};

export function Icon({ name, className }: { name: keyof typeof PATHS | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className ?? 'h-4 w-4'} aria-hidden>
      <path d={PATHS[name] ?? ''} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
