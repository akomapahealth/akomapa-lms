"use client";

import { MotionConfig } from "framer-motion";

/**
 * Honors prefers-reduced-motion globally (framer disables transform
 * animations, keeps opacity) without branching the rendered tree on the
 * client-only media query — which would cause hydration mismatches.
 */
export const MotionProvider = ({ children }: { children: React.ReactNode }) => {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
};
