'use client';

import { useI18n } from '@/components/i18n/I18nProvider';

interface ImageCaptionProps {
  /** Stock photography, or a render of something not yet built. */
  kind?: 'illustrative' | 'design';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
}

const POSITIONS = {
  'top-left': 'top-2 left-2',
  'top-right': 'top-2 right-2',
  'bottom-left': 'bottom-2 left-2',
  'bottom-right': 'bottom-2 right-2',
};

/**
 * A small caption laid over a photograph shown in an Aletheian context, so
 * stock imagery and design renders are never mistaken for real places or works.
 * The parent must be positioned (relative/absolute).
 */
export function ImageCaption({ kind = 'illustrative', position = 'top-left', className = '' }: ImageCaptionProps) {
  const { t } = useI18n();
  return (
    <span
      className={`absolute z-20 ${POSITIONS[position]} px-1.5 py-0.5 rounded-sm bg-[#060C14]/65 text-[10px] italic leading-none text-[#F4EEDF]/85 backdrop-blur-sm pointer-events-none ${className}`}
    >
      {kind === 'design' ? t('Design study.') : t('Illustrative image.')}
    </span>
  );
}
