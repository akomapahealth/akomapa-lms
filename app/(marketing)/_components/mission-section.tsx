import Image from "next/image";

import { SectionReveal } from "./section-reveal";

export const MissionSection = () => {
  return (
    <section id="mission" className="bg-background py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:px-8">
        <SectionReveal>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-akomapa-teal">
            Our mission
          </p>
          <blockquote className="font-display mt-6 text-pretty text-3xl font-medium leading-snug text-foreground sm:text-4xl lg:text-[2.75rem] lg:leading-[1.2]">
            &ldquo;Training future healthcare professionals to transform
            communities — with a good heart.&rdquo;
          </blockquote>
          <p className="mt-8 max-w-xl text-base leading-relaxed text-muted-foreground">
            Akomapa Academy is the learning home of GHELP, the Akomapa Global
            Health Education &amp; Leadership Program. Our students don&apos;t
            just study global health — they practice it, in community-rooted
            clinics, under the supervision of expert mentors who&apos;ve walked
            the path before them.
          </p>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            Akomapa Health Foundation is a 501(c)(3) nonprofit. Every course,
            every mentor hour, and every certificate serves one goal: ethical
            health leadership where it matters most.
          </p>
        </SectionReveal>
        <SectionReveal delay={0.15} className="relative">
          <div className="absolute -bottom-4 -right-4 hidden h-full w-full rounded-2xl border-2 border-akomapa-gold/60 sm:block" />
          <div className="relative aspect-[3/2] overflow-hidden rounded-2xl shadow-lift">
            <Image
              src="/landing/mission.jpg"
              alt="A medical student takes an elderly woman's blood pressure during community outreach while a mentor looks on"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        </SectionReveal>
      </div>
    </section>
  );
};
