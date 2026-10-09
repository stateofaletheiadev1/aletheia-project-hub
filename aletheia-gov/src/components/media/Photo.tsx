import Image from "next/image";
import { imageFor } from "@/content/images";

type Props = {
  name: string;
  sizes: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  /** Clip-path reveal from the bottom edge on first view (brief §6.7). */
  reveal?: boolean;
  parallax?: number;
  alt?: string;
  caption?: string;
};

// Graded, self-hosted photograph. The wrapper is the positioning box; the image fills it.
export function Photo({ name, sizes, className = "", imgClassName = "", priority, reveal = true, parallax, alt, caption }: Props) {
  const img = imageFor(name);
  // Callers may position the figure absolutely; only default to relative otherwise.
  const position = /(^|\s)(absolute|fixed)(\s|$)/.test(className) ? "" : "relative";
  return (
    <figure className={`${position} overflow-hidden ${className}`} data-clip-on={reveal ? "" : undefined}>
      <Image
        src={img.file}
        alt={alt ?? img.alt}
        width={img.width}
        height={img.height}
        sizes={sizes}
        quality={72}
        priority={priority}
        placeholder="blur"
        blurDataURL={img.blur}
        data-parallax={parallax}
        className={`h-full w-full object-cover ${imgClassName}`}
      />
      {caption ? (
        <figcaption className="absolute bottom-0 left-0 bg-navy-950/80 px-3 py-1.5 text-[0.6875rem] font-medium tracking-wide text-parchment-200">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
