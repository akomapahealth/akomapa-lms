"use client";

import Image from "next/image";
import { motion } from "framer-motion";

const courses = [
  { title: "Welcome to GHELP", blurb: "Orientation, values, and the Akomapa way." },
  { title: "Leadership, Power & Responsibility", blurb: "Who holds power in global health — and how to use it well." },
  { title: "Ethics & Values", blurb: "Navigating real dilemmas with a good heart." },
  { title: "Non-Communicable Diseases", blurb: "The quiet epidemic reshaping community health." },
  { title: "Sustainability", blurb: "Building programs that outlast their founders." },
  { title: "Community Health", blurb: "Care that starts where people actually live." },
  { title: "Research & Data", blurb: "Asking honest questions, measuring what matters." },
  { title: "Student-Led Care", blurb: "Running real clinics — supervised, accountable, yours." },
  { title: "Interprofessional Practice", blurb: "Medicine, nursing, pharmacy, public health: one team." },
  { title: "Reflection & Commitment", blurb: "Looking back to choose the road ahead." },
];

export const JourneySection = () => {
  return (
    <section id="journey" className="bg-akomapa-ice/30 py-24 sm:py-32 dark:bg-card/40">
      <div className="mx-auto grid max-w-7xl gap-14 px-4 sm:px-6 lg:grid-cols-[5fr_7fr] lg:gap-20 lg:px-8">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-akomapa-teal">
            The journey
          </p>
          <h2 className="font-display mt-6 text-pretty text-3xl font-semibold leading-tight text-foreground sm:text-4xl lg:text-5xl">
            Ten courses. One transformation.
          </h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
            The GHELP curriculum is a guided arc — from your first welcome to a
            lasting commitment. Each course builds on the last, measured by
            real growth, not just completion.
          </p>
          <div className="relative mt-10 hidden aspect-[4/3] overflow-hidden rounded-2xl shadow-soft lg:block">
            <Image
              src="/landing/journey.jpg"
              alt="Health students studying together around a table"
              fill
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
        <ol className="flex flex-col">
          {courses.map((course, i) => (
            <motion.li
              key={course.title}
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: (i % 5) * 0.05 }}
              className="group flex items-baseline gap-6 border-b border-border/70 py-6 first:pt-0 sm:gap-10"
            >
              <span className="font-display text-2xl font-medium tabular-nums text-akomapa-gold sm:text-3xl">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="font-display text-xl font-semibold text-foreground transition-colors group-hover:text-akomapa-teal sm:text-2xl">
                  {course.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {course.blurb}
                </p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
};
