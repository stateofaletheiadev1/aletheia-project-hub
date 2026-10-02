/**
 * ALETHEIA DESIGN TOKENS
 * Single Source of Truth for Visual Identity, Palette, Typography, and Motion.
 * Derived directly from pixel analysis of coat_of_arms.png, flag_a.png, flag_b.png,
 * and the National Blueprint Edition 2026.3.
 */

export const ALETHEIA_TOKENS = {
  // Brand & Heraldic Palette
  colors: {
    // Primary Sovereignty
    covenantNavy: {
      DEFAULT: '#15294A',
      rgb: 'rgb(21, 41, 74)',
      hsl: 'hsl(217, 56%, 19%)',
      deep: '#0E1B31',
      subtle: '#1C3660',
      surface: 'rgba(21, 41, 74, 0.04)',
      border: 'rgba(21, 41, 74, 0.14)',
    },
    // Primary Substrate / Truth Record
    ledgerParchment: {
      DEFAULT: '#F4EEDF',
      rgb: 'rgb(244, 238, 223)',
      hsl: 'hsl(43, 51%, 92%)',
      light: '#FAF7F0',
      canvas: '#F6F3EC',
      dark: '#E8DECA',
      border: 'rgba(196, 154, 78, 0.28)',
    },
    // Honor & Covenant
    sealGold: {
      DEFAULT: '#C49A4E',
      rgb: 'rgb(196, 154, 78)',
      hsl: 'hsl(39, 52%, 54%)',
      shadow: '#8F6A2A',
      tint: '#E4C689',
      subtle: 'rgba(196, 154, 78, 0.12)',
      border: 'rgba(196, 154, 78, 0.35)',
    },
    // Civic & Renewal
    laurelGreen: {
      DEFAULT: '#2F6B4F',
      rgb: 'rgb(47, 107, 79)',
      hsl: 'hsl(152, 37%, 31%)',
      deep: '#214C38',
      light: '#3D8664',
      subtle: 'rgba(47, 107, 79, 0.12)',
    },
    // Diplomatic & eMRTD Passport
    covenantBurgundy: {
      DEFAULT: '#701824',
      rgb: 'rgb(112, 24, 36)',
      hsl: 'hsl(352, 65%, 27%)',
      deep: '#4E1019',
      subtle: 'rgba(112, 24, 36, 0.10)',
    },
    // Technical Keyline
    obsidian: {
      DEFAULT: '#101418',
      pure: '#0B0E11',
      muted: '#4A5568',
      subtle: '#718096',
    },
    // Status Taxonomy Colors
    status: {
      operational: {
        text: '#1B5E38',
        bg: '#EAF6EE',
        border: '#9AD6AF',
      },
      underDevelopment: {
        text: '#8F5800',
        bg: '#FDF6E2',
        border: '#ECC974',
      },
      planned: {
        text: '#1A4A7A',
        bg: '#EBF3FB',
        border: '#9DC3EA',
      },
      proposed: {
        text: '#583688',
        bg: '#F5EFFD',
        border: '#CBB2EC',
      },
      vision: {
        text: '#4A5568',
        bg: '#F0F2F5',
        border: '#CBD5E0',
      },
    },
  },

  // Typography Scale (Manrope)
  typography: {
    fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    scale: {
      display: {
        fontSize: 'clamp(2.75rem, 5vw, 4.5rem)',
        lineHeight: '1.08',
        letterSpacing: '-0.025em',
        fontWeight: '700',
      },
      h1: {
        fontSize: 'clamp(2.25rem, 3.5vw, 3.25rem)',
        lineHeight: '1.14',
        letterSpacing: '-0.02em',
        fontWeight: '700',
      },
      h2: {
        fontSize: 'clamp(1.75rem, 2.5vw, 2.25rem)',
        lineHeight: '1.22',
        letterSpacing: '-0.015em',
        fontWeight: '600',
      },
      h3: {
        fontSize: '1.375rem',
        lineHeight: '1.3',
        letterSpacing: '-0.01em',
        fontWeight: '600',
      },
      bodyLarge: {
        fontSize: '1.125rem',
        lineHeight: '1.6',
        letterSpacing: '0',
        fontWeight: '400',
      },
      body: {
        fontSize: '1rem',
        lineHeight: '1.6',
        letterSpacing: '0',
        fontWeight: '400',
      },
      eyebrow: {
        fontSize: '0.75rem',
        lineHeight: '1.4',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        fontWeight: '600',
      },
      tabular: {
        fontSize: '0.875rem',
        lineHeight: '1.5',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '0.01em',
      },
      caption: {
        fontSize: '0.8125rem',
        lineHeight: '1.4',
        letterSpacing: '0.01em',
        fontWeight: '400',
      },
    },
  },

  // Architectural Radius Scale (Anti-Pill / Anti-Template)
  radius: {
    none: '0px',
    subtle: '2px',
    standard: '4px',
    card: '6px', // Maximum card radius to maintain disciplined architectural aesthetic
  },

  // Motion Tokens
  motion: {
    easing: {
      sovereign: [0.16, 1, 0.3, 1], // easeOutExpo
      deliberate: [0.25, 0.1, 0.25, 1],
    },
    duration: {
      micro: 0.15,
      standard: 0.35,
      ceremonial: 0.65,
      grand: 1.0,
    },
  },
} as const;
