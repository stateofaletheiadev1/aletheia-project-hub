import React from 'react';
import Image from 'next/image';

interface FlagProps {
  variant?: 'a' | 'b';
  width?: number;
  height?: number;
  className?: string;
  bordered?: boolean;
}

export function NationalFlag({
  width = 90,
  height = 60,
  className = '',
  bordered = true,
}: Omit<FlagProps, 'variant'>) {
  return (
    <div
      className={`relative inline-block overflow-hidden ${
        bordered ? 'border border-gold/30 shadow-subtle' : ''
      } ${className}`}
      style={{ width, height }}
      title="National Flag of Aletheia (Option A: Nordic Cross with Star of Truth)"
    >
      <Image
        src="/flag_a.png"
        alt="National Flag of Aletheia"
        width={width}
        height={height}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

export function StateEnsign({
  width = 90,
  height = 60,
  className = '',
  bordered = true,
}: Omit<FlagProps, 'variant'>) {
  return (
    <div
      className={`relative inline-block overflow-hidden ${
        bordered ? 'border border-gold/30 shadow-subtle' : ''
      } ${className}`}
      style={{ width, height }}
      title="State & Civil Ensign of Aletheia (Option B: Golden-Edged Triband with Central Hexagon)"
    >
      <Image
        src="/flag_b.png"
        alt="State and Civil Ensign of Aletheia"
        width={width}
        height={height}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
