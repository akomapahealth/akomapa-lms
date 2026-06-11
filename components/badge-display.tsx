"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Award, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface BadgeDisplayProps {
  name: string;
  description: string;
  type: string;
  earned: boolean;
  earnedAt: Date | null;
  imageUrl?: string | null;
}

const badgeEmojis: Record<string, string> = {
  COMPLETION: "🎯",
  STREAK: "🔥",
  COMMUNITY: "💬",
  QUIZ_SCORE: "⭐",
  MILESTONE: "🏆",
};

export const BadgeDisplay = ({
  name,
  description,
  type,
  earned,
  earnedAt,
  imageUrl,
}: BadgeDisplayProps) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all",
              earned
                ? "bg-card border-akomapa-gold/30 shadow-sm"
                : "bg-muted border-border opacity-50 grayscale"
            )}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-lg",
                earned ? "bg-akomapa-gold/10" : "bg-muted"
              )}
            >
              {earned ? (
                imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt={name} className="w-6 h-6" />
                ) : (
                  <span>{badgeEmojis[type] ?? "🎯"}</span>
                )
              ) : (
                <Lock className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <span className="text-xs font-medium text-center line-clamp-1">
              {name}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <div className="space-y-1">
            <p className="font-semibold text-sm flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              {name}
            </p>
            <p className="text-xs text-muted-foreground">{description}</p>
            {earned && earnedAt && (
              <p className="text-xs text-emerald-600">
                Earned {new Date(earnedAt).toLocaleDateString()}
              </p>
            )}
            {!earned && (
              <p className="text-xs text-muted-foreground">Not yet earned</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
