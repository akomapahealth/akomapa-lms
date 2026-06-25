import { MarketingFooter } from "./_components/marketing-footer";
import { MarketingNav } from "./_components/marketing-nav";
import { MotionProvider } from "./_components/motion-provider";

const MarketingLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <MotionProvider>
      <div className="min-h-dvh bg-background text-foreground">
        <MarketingNav />
        {children}
        <MarketingFooter />
      </div>
    </MotionProvider>
  );
};

export default MarketingLayout;
