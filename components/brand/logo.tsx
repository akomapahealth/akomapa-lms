import Image from "next/image";

import { cn } from "@/lib/utils";

/*
 * Akomapa Academy brand mark — the gold "akoma" (adinkra heart) glyph with
 * a cross on a teal tile. Self-contained PNG with its own rounded tile and a
 * transparent background, so it sits cleanly on any surface.
 */

interface BrandMarkProps {
  /** Rendered square size in px */
  size?: number;
  className?: string;
}

export const BrandMark = ({ size = 36, className }: BrandMarkProps) => {
  return (
    <Image
      src="/logo/mark.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      sizes={`${size}px`}
      className={cn("shrink-0 select-none object-contain", className)}
    />
  );
};
