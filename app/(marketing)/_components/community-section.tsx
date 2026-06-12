import Image from "next/image";

import { SectionReveal } from "./section-reveal";

export const CommunitySection = () => {
  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[5fr_7fr] lg:gap-20 lg:px-8">
        <SectionReveal className="relative order-last lg:order-first">
          <div className="absolute -bottom-4 -left-4 hidden h-full w-full rounded-2xl bg-akomapa-ice sm:block dark:bg-card" />
          <div className="relative aspect-[3/4] max-w-md overflow-hidden rounded-2xl shadow-lift">
            <Image
              src="/landing/community.jpg"
              alt="A student leader teaching a community health education session"
              fill
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover"
            />
          </div>
        </SectionReveal>
        <SectionReveal delay={0.1}>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-akomapa-teal">
            Learn together
          </p>
          <h2 className="font-display mt-6 text-pretty text-3xl font-semibold leading-tight text-foreground sm:text-4xl lg:text-5xl">
            Nobody leads alone.
          </h2>
          <figure className="mt-10">
            <span
              aria-hidden="true"
              className="font-display block text-6xl font-semibold leading-none text-akomapa-gold"
            >
              &ldquo;
            </span>
            <blockquote className="font-display -mt-3 text-xl font-medium leading-relaxed text-foreground sm:text-2xl">
              GHELP didn&apos;t just teach me global health — it gave me a
              community that expects me to lead, and mentors who make sure I
              can.
            </blockquote>
            <figcaption className="mt-4 text-sm text-muted-foreground">
              Student leader, GHELP cohort
            </figcaption>
          </figure>
          <p className="mt-10 max-w-xl text-base leading-relaxed text-muted-foreground">
            Discussion forums for every course theme, a reflection journal that
            grows with you, streaks and badges that celebrate showing up — the
            Academy is built so the journey is shared, not solitary.
          </p>
        </SectionReveal>
      </div>
    </section>
  );
};
