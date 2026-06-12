import { cn } from "@/lib/utils";

const widths = {
  narrow: "max-w-3xl",
  default: "max-w-5xl",
  wide: "max-w-7xl",
  full: "max-w-none",
} as const;

interface PageContainerProps {
  width?: keyof typeof widths;
  className?: string;
  children: React.ReactNode;
}

export const PageContainer = ({
  width = "default",
  className,
  children,
}: PageContainerProps) => {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8",
        widths[width],
        className
      )}
    >
      {children}
    </div>
  );
};
