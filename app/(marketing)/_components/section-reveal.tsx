"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

interface SectionRevealProps {
  className?: string;
  delay?: number;
  children: React.ReactNode;
}

export const SectionReveal = ({
  className,
  delay = 0,
  children,
}: SectionRevealProps) => {
  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      {children}
    </motion.div>
  );
};
