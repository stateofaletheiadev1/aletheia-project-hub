'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import React from 'react';
import Image from 'next/image';
import Link from '@/components/i18n/Link';

interface LogoProps {
  variant?: 'full' | 'symbol' | 'horizontal' | 'seal';
  size?: 'sm' | 'md' | 'lg' | 'hero';
  theme?: 'light' | 'dark';
  className?: string;
}

export function StarOfTruth({ size = 28, className = '' }: { size?: number; className?: string }) {
  const { t } = useI18n();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label={t("Star of Truth (Aletheia)")}
    >
      {/* 8-pointed star with central annulus */}
      <path
        d="M50 0L57.5 35L85.4 14.6L65 42.5L100 50L65 57.5L85.4 85.4L57.5 65L50 100L42.5 65L14.6 85.4L35 57.5L0 50L35 42.5L14.6 14.6L42.5 35L50 0Z"
        fill="#C49A4E"
      />
      <circle cx="50" cy="50" r="12" fill="#15294A" />
      <circle cx="50" cy="50" r="6" fill="#C49A4E" />
    </svg>
  );
}

export function HexagonCross({ size = 32, className = '' }: { size?: number; className?: string }) {
  const { t } = useI18n();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 115"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label={t("Federal Inescutcheon of Antioch")}
    >
      {/* Hexagon */}
      <polygon
        points="50,0 95,27 95,85 50,112 5,85 5,27"
        fill="#15294A"
        stroke="#C49A4E"
        strokeWidth="6"
      />
      {/* Inner thin gold rim */}
      <polygon
        points="50,8 87,31 87,81 50,104 13,81 13,31"
        fill="none"
        stroke="#C49A4E"
        strokeWidth="2"
      />
      {/* Latin Cross */}
      <path
        d="M45 28H55V44H70V54H55V84H45V54H30V44H45V28Z"
        fill="#F4EEDF"
      />
    </svg>
  );
}

export function Logo({
  variant = 'horizontal',
  size = 'md',
  theme = 'light',
  className = '',
}: LogoProps) {
  const { t } = useI18n();
  const dimensions = {
    sm: { img: 32, text: 'text-sm', sub: 'text-[8.5px]' },
    md: { img: 38, text: 'text-[15px]', sub: 'text-[9px]' },
    lg: { img: 56, text: 'text-xl', sub: 'text-xs' },
    hero: { img: 88, text: 'text-3xl', sub: 'text-sm' },
  }[size];

  const isDark = theme === 'dark';

  if (variant === 'symbol') {
    return (
      <div className={`relative inline-block ${className}`}>
        <Image
          src="/coat_of_arms_transparent.png"
          alt={t("Aletheia Arms")}
          width={dimensions.img}
          height={dimensions.img * 1.17}
          className="object-contain"
          priority
        />
      </div>
    );
  }

  return (
    <Link
      href="/"
      className={`group inline-flex items-center gap-3 tracking-tight transition-opacity hover:opacity-90 ${className}`}
      aria-label={t("Aletheia Home")}
    >
      <div className="relative shrink-0 flex items-center justify-center">
        <Image
          src="/coat_of_arms_transparent.png"
          alt={t("Coat of Arms of the Sovereign Covenant State of Aletheia")}
          width={dimensions.img}
          height={Math.round(dimensions.img * 1.17)}
          className="object-contain drop-shadow-sm"
          priority
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <span
          className={`font-bold tracking-[0.18em] uppercase font-sans leading-none ${
            isDark ? 'text-parchment' : 'text-navy'
          } ${dimensions.text}`}
        >{t("ALETHEIA")}</span>
        <span
          className={`tracking-[0.14em] uppercase font-semibold whitespace-nowrap leading-none ${
            isDark ? 'text-gold/80' : 'text-gold'
          } ${dimensions.sub}`}
        >{t("Sovereign Covenant State")}</span>
      </div>
    </Link>
  );
}
