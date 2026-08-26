"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const links = [
  { label: "Mission", href: "/#mission" },
  { label: "The Journey", href: "/#journey" },
  { label: "Outcomes", href: "/#outcomes" },
  { label: "Verify a Certificate", href: "/verify" },
];

export const MarketingNav = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-30 text-foreground transition-colors duration-300",
        scrolled
          ? "border-b border-border/60 bg-background/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Akomapa Academy home" className="flex items-center">
          <Image
            src="/logo/wordmark.png"
            alt="Akomapa Academy"
            width={728}
            height={280}
            priority
            className="h-9 w-auto sm:h-10"
          />
        </Link>

        <div className="hidden items-center gap-7 text-sm font-medium lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-foreground/70 transition hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://www.akomapa.org"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-foreground/70 transition hover:text-foreground"
          >
            Akomapa.org
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/sign-in" className="hidden sm:block">
            <Button size="sm" variant="ghost" className="hover:bg-foreground/5">
              Sign in
            </Button>
          </Link>
          <Link href="/sign-up">
            <Button
              size="sm"
              className="bg-akomapa-gold font-semibold text-[hsl(187_80%_10%)] hover:bg-akomapa-gold/90"
            >
              Get started
            </Button>
          </Link>

          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger
              aria-label="Open menu"
              className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-md transition hover:bg-foreground/5 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-background">
              <SheetTitle className="font-display text-lg font-semibold">
                Akomapa Academy
              </SheetTitle>
              <nav className="mt-8 flex flex-col gap-1">
                {links.map((link) => (
                  <SheetClose asChild key={link.href}>
                    <Link
                      href={link.href}
                      className="rounded-md px-3 py-2.5 text-base font-medium text-foreground/80 transition hover:bg-secondary hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
              <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6">
                <SheetClose asChild>
                  <Link href="/sign-in">
                    <Button variant="outline" className="w-full">
                      Sign in
                    </Button>
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link href="/sign-up">
                    <Button className="w-full bg-akomapa-gold font-semibold text-[hsl(187_80%_10%)] hover:bg-akomapa-gold/90">
                      Get started
                    </Button>
                  </Link>
                </SheetClose>
                <a
                  href="https://www.akomapa.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                >
                  Visit Akomapa.org
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
};
