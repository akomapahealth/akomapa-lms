"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { label: "Mission", href: "#mission" },
  { label: "The Journey", href: "#journey" },
  { label: "Outcomes", href: "#outcomes" },
  { label: "Verify a Certificate", href: "/verify" },
];

export const MarketingNav = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-30 transition-colors duration-300",
        scrolled
          ? "border-b border-border/60 bg-background/85 text-foreground backdrop-blur-md"
          : "border-b border-transparent bg-transparent text-surface-deep-foreground"
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/akomapa-logo.png"
            alt="Akomapa Academy"
            width={36}
            height={36}
            className="rounded-full"
          />
          <span className="font-display text-lg font-semibold tracking-tight">
            Akomapa Academy
          </span>
        </Link>
        <div className="hidden items-center gap-7 text-sm font-medium lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="opacity-80 transition hover:opacity-100"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/sign-in" className="hidden sm:block">
            <Button
              size="sm"
              variant="ghost"
              className={cn(
                "hover:bg-foreground/5",
                !scrolled &&
                  "text-surface-deep-foreground hover:bg-surface-deep-foreground/10 hover:text-surface-deep-foreground"
              )}
            >
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
        </div>
      </nav>
    </header>
  );
};
