import Image from "next/image";
import Link from "next/link";

import { BrandLogo } from "@/components/brand/logo";

const currentYear = new Date().getFullYear();

const stats = [
  { value: "500+", label: "Patients served" },
  { value: "100+", label: "Student leaders" },
  { value: "4", label: "Countries" },
];

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* Left — brand panel */}
      <div className="relative hidden overflow-hidden bg-surface-deep text-surface-deep-foreground md:flex md:w-1/2">
        <Image
          src="/landing/auth.jpg"
          alt=""
          fill
          priority
          sizes="(max-width: 767px) 0px, 50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[hsl(187_80%_10%)]/70" />
        <div className="relative z-10 flex h-full flex-col justify-end p-10 lg:p-14">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-akomapa-gold">
            Nya Akomapa — Have a good heart
          </p>
          <h2 className="font-display mt-4 max-w-md text-balance text-3xl font-semibold leading-tight lg:text-4xl">
            Empowering the next generation of health leaders.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed opacity-80 lg:text-base">
            Student-powered, expert-supervised learning through the Akomapa
            Global Health Education &amp; Leadership Program.
          </p>
          <dl className="mt-8 flex gap-8 border-t border-surface-deep-foreground/15 pt-6">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dd className="font-display text-2xl font-semibold text-akomapa-gold">
                  {stat.value}
                </dd>
                <dt className="mt-0.5 text-xs uppercase tracking-[0.14em] opacity-70">
                  {stat.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Right — form panel */}
      <div className="flex w-full flex-col items-center justify-center bg-background p-6 md:w-1/2 md:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center animate-scale-in">
            <Link href="/" aria-label="Back to Akomapa Academy home">
              <BrandLogo size={44} wordmarkClassName="text-xl" />
            </Link>
          </div>

          <div className="animate-fade-in rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
            {children}
          </div>

          <div className="mt-8 text-center text-sm text-muted-foreground animate-fade-in">
            <p>
              A program of Akomapa Health Foundation — a 501(c)(3) nonprofit.
            </p>
            <div className="mt-3 flex justify-center gap-4">
              <Link
                href="/"
                className="transition-colors hover:text-akomapa-teal"
              >
                About the Academy
              </Link>
              <a
                href="https://www.akomapa.org"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-akomapa-teal"
              >
                akomapa.org
              </a>
            </div>
            <p className="mt-4 text-xs opacity-70">
              © {currentYear} Akomapa Academy. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
