"use client";

import { useEffect } from "react";
import { useConfettiStore } from "@/hooks/use-confetti-store";

interface ResultsConfettiProps {
  passed: boolean;
}

export const ResultsConfetti = ({ passed }: ResultsConfettiProps) => {
  const confetti = useConfettiStore();

  useEffect(() => {
    if (passed) {
      confetti.onOpen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passed]);

  return null;
};
