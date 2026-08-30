import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#101815',
          soft: '#3d4a45',
          faint: '#6b7a74',
        },
        surface: {
          DEFAULT: '#ffffff',
          sunken: '#f5f7f6',
          raised: '#ffffff',
        },
        line: '#e2e8e5',
        // Teal brand accent, per the reference frames.
        accent: {
          DEFAULT: '#0d9488',
          soft: '#e7f6f3',
          strong: '#0b7a70',
        },
        // The dark pine shell: sidebar, onboarding modal, sign-in.
        shell: {
          DEFAULT: '#0c1512',
          raised: '#12201b',
          hover: '#17281f',
          line: '#1f332a',
          text: '#93a8a0',
          bright: '#e8f1ed',
        },
        positive: { DEFAULT: '#0b7a4b', soft: '#e7f5ee' },
        caution: { DEFAULT: '#8a5a00', soft: '#fdf3e0' },
        critical: { DEFAULT: '#b3261e', soft: '#fdecea' },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Inter', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: { xl: '0.75rem', '2xl': '1rem' },
      boxShadow: {
        card: '0 1px 2px rgba(12, 21, 18, 0.04), 0 1px 3px rgba(12, 21, 18, 0.06)',
        lifted: '0 4px 16px rgba(12, 21, 18, 0.08)',
      },
      backgroundImage: {
        // The dotted canvas behind the Brand Brain graph.
        dotgrid: 'radial-gradient(circle, #d5ded9 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
} satisfies Config;
