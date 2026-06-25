import { CountUp } from "./count-up";
import { SectionReveal } from "./section-reveal";

const stats = [
  { value: 500, suffix: "+", label: "Patients served" },
  { value: 100, suffix: "+", label: "Student leaders" },
  { value: 10, suffix: "+", label: "Partner institutions" },
  { value: 4, suffix: "", label: "Countries" },
];

export const StatsBand = () => {
  return (
    <section className="border-y border-border/60 bg-background py-16 sm:py-20">
      <SectionReveal>
        <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-10 px-4 text-center sm:px-6 lg:grid-cols-4 lg:px-8">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dd>
                <CountUp
                  to={stat.value}
                  suffix={stat.suffix}
                  className="font-display text-5xl font-semibold text-akomapa-teal sm:text-6xl"
                />
              </dd>
              <dt className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {stat.label}
              </dt>
            </div>
          ))}
        </dl>
      </SectionReveal>
    </section>
  );
};
