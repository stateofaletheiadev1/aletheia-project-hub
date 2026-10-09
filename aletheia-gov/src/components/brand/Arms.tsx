import Image from "next/image";
import arms from "../../../public/brand/arms.png";

// The arms of the Sovereign Covenant State of Aletheia. Never below 64px tall.
export function Arms({ height = 96, className = "", priority = false }: { height?: number; className?: string; priority?: boolean }) {
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
