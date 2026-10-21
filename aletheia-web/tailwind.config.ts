import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#15294A',
          deep: '#0E1B31',
          subtle: '#1C3660',
          surface: 'rgba(21, 41, 74, 0.04)',
          border: 'rgba(21, 41, 74, 0.12)',
        },
        parchment: {
          DEFAULT: '#F4EEDF',
          canvas: '#F6F3EC',
          light: '#FAF7F0',
          dark: '#E8DECA',
          border: 'rgba(196, 154, 78, 0.28)',
        },
        gold: {
          DEFAULT: '#C49A4E',
          shadow: '#7A5A22',
          tint: '#E4C689',
          ink: '#7F5E25',
          subtle: 'rgba(196, 154, 78, 0.12)',
          border: 'rgba(196, 154, 78, 0.35)',
        },
        laurel: {
          DEFAULT: '#2F6B4F',
          deep: '#214C38',
          light: '#3D8664',
          subtle: 'rgba(47, 107, 79, 0.12)',
        },
        burgundy: {
          DEFAULT: '#701824',
          deep: '#4E1019',
          subtle: 'rgba(112, 24, 36, 0.10)',
        },
        obsidian: {
          DEFAULT: '#101418',
          pure: '#0B0E11',
          muted: '#4A5568',
        },
      },
      fontFamily: {
        sans: ['var(--font-manrope)', 'Manrope', 'sans-serif'],
        // Manrope is the State's only typeface: "serif" and "mono" resolve to it too.
        serif: ['var(--font-manrope)', 'Manrope', 'sans-serif'],
        mono: ['var(--font-manrope)', 'Manrope', 'sans-serif'],
      },
      fontWeight: {
        // Manrope 300 is too faint for body copy on cream; light text sets at 400.
        light: '400',
      },
      borderRadius: {
        none: '0px',
        sm: '2px',
        DEFAULT: '4px',
        md: '6px',
        lg: '8px',
      },
      letterSpacing: {
        tighter: '-0.03em',
        tight: '-0.015em',
        normal: '0em',
        wide: '0.03em',
        wider: '0.06em',
        widest: '0.1em',
        eyebrow: '0.13em',
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(16, 20, 24, 0.05)',
        institutional: '0 1px 0 rgba(21, 41, 74, 0.04), 0 2px 6px -2px rgba(21, 41, 74, 0.08)',
        elevated: '0 1px 0 rgba(21, 41, 74, 0.05), 0 10px 24px -12px rgba(21, 41, 74, 0.22)',
        goldGlow: '0 0 0 1px rgba(196, 154, 78, 0.3)',
      },
    },
  },
  plugins: [],
};

export default config;
