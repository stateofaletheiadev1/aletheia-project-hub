import Image from "next/image";
import arms from "../../../public/brand/arms.png";

// The arms of the Sovereign Covenant State of Aletheia: an emblem of state, used on the
// sign-in screen and exported records, never as decoration (brief §12.3). Never below 64 px.
export function Arms({ height = 96, className, priority = false }: { height?: number; className?: string; priority?: boolean }) {
  const width = Math.round((arms.width / arms.height) * height);
  return (
    <Image
      src={arms}
      alt="The arms of the Sovereign Covenant State of Aletheia"
      width={width}
      height={height}
      sizes={`${width}px`}
      quality={80}
      priority={priority}
      className={className}
    />
  );
}
