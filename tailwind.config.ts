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
          shadow: '#8F6A2A',
          tint: '#E4C689',
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
        serif: ['Georgia', 'serif'],
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
        wide: '0.04em',
        wider: '0.08em',
        eyebrow: '0.18em',
      },
      boxShadow: {
        subtle: '0 1px 3px rgba(16, 20, 24, 0.05)',
        institutional: '0 4px 20px -2px rgba(21, 41, 74, 0.08)',
        elevated: '0 10px 30px -4px rgba(21, 41, 74, 0.12)',
        goldGlow: '0 0 25px rgba(196, 154, 78, 0.18)',
      },
    },
  },
  plugins: [],
};

export default config;
