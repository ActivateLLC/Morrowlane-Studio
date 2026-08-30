import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#101418',
          soft: '#3d4753',
          faint: '#6b7684',
        },
        surface: {
          DEFAULT: '#ffffff',
          sunken: '#f6f7f9',
          raised: '#ffffff',
        },
        line: '#e3e7ec',
        accent: {
          DEFAULT: '#1b4dd8',
          soft: '#eef2fe',
          strong: '#12369c',
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
        card: '0 1px 2px rgba(16, 20, 24, 0.04), 0 1px 3px rgba(16, 20, 24, 0.06)',
        lifted: '0 4px 16px rgba(16, 20, 24, 0.08)',
      },
    },
  },
  plugins: [],
} satisfies Config;
