import Link from "next/link";

import type { LegalBlock, LegalPage } from "@/lib/legal-content";
import { siteConfig } from "@/lib/site-config";

type LegalDocumentProps = {
  page: LegalPage;
};

const otherDoc = (slug: LegalPage["slug"]) =>
  slug === "privacy"
    ? { href: "/terms", label: "Terms of Service" }
    : { href: "/privacy", label: "Privacy Policy" };

const Block = ({ block }: { block: LegalBlock }) => {
  return (
    <>
      {block.paragraphs?.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {block.bullets && block.bullets.length > 0 ? (
        <ul className="list-disc space-y-2 pl-5 marker:text-akomapa-teal">
          {block.bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
};

export const LegalDocument = ({ page }: LegalDocumentProps) => {
  const related = otherDoc(page.slug);

  return (
    <main className="bg-background">
      <header className="relative overflow-hidden border-b border-border bg-gradient-to-b from-secondary/70 via-background to-background">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-[-12%] h-72 w-72 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-28 sm:px-6 sm:pb-16 sm:pt-32 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-akomapa-teal">
            Legal
          </p>
          <h1 className="font-display mt-4 max-w-3xl text-pretty text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {page.title}
          </h1>
          <p className="mt-4 max-w-[62ch] text-base leading-relaxed text-muted-foreground">
            {page.description}
          </p>
          <dl className="mt-8 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-10">
            <div>
              <dt className="font-medium text-foreground">Effective</dt>
              <dd>{siteConfig.legalEffectiveDate}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Operator</dt>
              <dd>{siteConfig.organization}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Related</dt>
              <dd>
                <Link
                  href={related.href}
                  className="text-akomapa-teal underline-offset-4 transition hover:underline"
                >
                  {related.label}
                </Link>
              </dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16 lg:px-8 lg:py-16">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-sm font-semibold text-foreground">On this page</p>
          <nav
            aria-label={`${page.title} sections`}
            className="mt-4 max-h-[70vh] overflow-y-auto pr-2"
          >
            <ol className="flex flex-col gap-1.5 text-sm">
              {page.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="block min-h-11 rounded-md px-2 py-2.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="min-w-0">
          <div className="rounded-2xl border border-akomapa-gold/40 bg-akomapa-gold/10 px-5 py-4 sm:px-6">
            <p className="text-sm font-semibold text-foreground">
              {page.notice.title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">
              {page.notice.body}
            </p>
          </div>

          <div className="mt-12">
            {page.sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-24 border-t border-border pt-10 first:border-t-0 first:pt-0"
              >
                <h2 className="font-display text-2xl font-semibold text-foreground">
                  {section.title}
                </h2>
                <div className="mt-4 space-y-4 text-base leading-[1.7] text-foreground/80">
                  <Block block={section} />
                  {section.subsections?.map((subsection) => (
                    <div key={subsection.title} className="space-y-3 pt-2">
                      <h3 className="text-lg font-semibold text-foreground">
                        {subsection.title}
                      </h3>
                      <Block block={subsection} />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <p className="mt-14 text-sm text-muted-foreground">
            Also see the{" "}
            <Link
              href={related.href}
              className="font-medium text-akomapa-teal underline-offset-4 hover:underline"
            >
              {related.label}
            </Link>
            . Questions:{" "}
            <a
              href={siteConfig.contactUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-akomapa-teal underline-offset-4 hover:underline"
            >
              contact Akomapa
            </a>
            .
          </p>
        </article>
      </div>
    </main>
  );
};
