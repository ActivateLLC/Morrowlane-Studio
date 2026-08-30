import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#101815',
          soft: '#3d4a45',
          // #6b7a74 measured 4.19:1 on the sunken surface — below AA. This clears
          // 4.5:1 on white, sunken and the blurred top bar alike.
          faint: '#63726c',
        },
        surface: {
          DEFAULT: '#ffffff',
          sunken: '#f5f7f6',
          raised: '#ffffff',
        },
        line: '#e2e8e5',
        // Teal brand accent, per the reference frames.
        // Teal brand accent. DEFAULT is the brand hue for large marks and borders;
        // `strong` is the accessible one (5.21:1 with white, 5.21:1 as text on white)
        // and is what every button fill and text use must reference.
        accent: {
          DEFAULT: '#0d9488',
          soft: '#e7f6f3',
          strong: '#0b7a70',
          deep: '#095f57',
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
