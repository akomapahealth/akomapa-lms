import Image from "next/image";
import Link from "next/link";

export const MarketingFooter = () => {
  return (
    <footer className="border-t border-surface-deep-foreground/10 bg-surface-deep text-surface-deep-foreground">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Image
              src="/logo/wordmark-footer.svg"
              alt="Akomapa Academy"
              width={784}
              height={329}
              unoptimized
              className="h-10 w-auto"
            />
            <p className="mt-4 text-sm leading-relaxed opacity-70">
              The Akomapa Global Health Education &amp; Leadership Program
              (GHELP). Student-powered, expert-supervised learning for the next
              generation of health leaders.
            </p>
            <p className="mt-4 text-xs uppercase tracking-[0.18em] text-akomapa-gold">
              Nya Akomapa — Have a good heart
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
            <div className="flex flex-col gap-3">
              <p className="font-semibold">Program</p>
              <Link href="/#mission" className="opacity-70 transition hover:opacity-100">
                Mission
              </Link>
              <Link href="/#journey" className="opacity-70 transition hover:opacity-100">
                The Journey
              </Link>
              <Link href="/#outcomes" className="opacity-70 transition hover:opacity-100">
                Outcomes
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              <p className="font-semibold">Platform</p>
              <Link href="/sign-in" className="opacity-70 transition hover:opacity-100">
                Sign in
              </Link>
              <Link href="/sign-up" className="opacity-70 transition hover:opacity-100">
                Create account
              </Link>
              <Link href="/verify" className="opacity-70 transition hover:opacity-100">
                Verify a certificate
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              <p className="font-semibold">Akomapa</p>
              <a
                href="https://www.akomapa.org"
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-70 transition hover:opacity-100"
              >
                akomapa.org
              </a>
              <Link href="/privacy" className="opacity-70 transition hover:opacity-100">
                Privacy
              </Link>
              <Link href="/terms" className="opacity-70 transition hover:opacity-100">
                Terms
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-surface-deep-foreground/10 pt-6 text-xs opacity-60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} Akomapa Health Foundation. A 501(c)(3)
            nonprofit organization.
          </p>
          <div className="flex gap-4">
            <Link href="/privacy" className="transition hover:opacity-100">
              Privacy
            </Link>
            <Link href="/terms" className="transition hover:opacity-100">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
