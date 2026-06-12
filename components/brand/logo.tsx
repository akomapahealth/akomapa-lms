import { cn } from "@/lib/utils";

/*
 * Placeholder brand identity for Akomapa Academy.
 * The mark is an "akoma" (heart) glyph on a gold tile — swap the SVG in
 * BrandMark when final logo artwork arrives; every surface uses it.
 */

interface BrandMarkProps {
  /** Tile size in px */
  size?: number;
  className?: string;
}

export const BrandMark = ({ size = 36, className }: BrandMarkProps) => {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[26%] bg-akomapa-gold text-[hsl(187_80%_12%)]",
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        style={{ width: size * 0.56, height: size * 0.56 }}
      >
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    </span>
  );
};

interface BrandLogoProps {
  /** Tile size in px */
  size?: number;
  className?: string;
  wordmarkClassName?: string;
}

export const BrandLogo = ({
  size = 36,
  className,
  wordmarkClassName,
}: BrandLogoProps) => {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark size={size} />
      <span
        className={cn(
          "font-display text-lg font-semibold tracking-tight",
          wordmarkClassName
        )}
      >
        Akomapa Academy
      </span>
    </span>
  );
};
