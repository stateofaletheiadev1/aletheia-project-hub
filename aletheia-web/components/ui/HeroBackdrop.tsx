import Image from 'next/image';
import { unsplash, type PhotoKey } from '@/lib/imagery';
import { ImageCaption } from '@/components/ui/ImageCaption';

interface HeroBackdropProps {
  image: PhotoKey;
  /** Photo opacity beneath the navy wash (0–1). */
  intensity?: number;
  /** CSS object-position for the photo. */
  position?: string;
}

/**
 * Full-bleed photographic layer for dark guilloche heroes. Sits absolutely
 * behind hero content: a slowly drifting photograph, a sovereign navy wash,
 * and a gold horizon glow. Decorative only — hidden from assistive tech.
 */
export function HeroBackdrop({ image, intensity = 0.32, position = 'center' }: HeroBackdropProps) {
  return (
    <>
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0 animate-ken-burns">
        <Image
          src={unsplash(image, 2000)}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: position, opacity: intensity }}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-[#060C14]/95 via-[#0E1B31]/80 to-[#0E1B31]/45" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#060C14]/90 via-transparent to-[#060C14]/40" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
    </div>
    <ImageCaption position="bottom-right" />
    </>
  );
}
