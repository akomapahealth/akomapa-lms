import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

const statusConfig: Record<Status, { label: string; className: string }> = {
  NOT_STARTED: {
    label: "Not Started",
    className: "bg-muted text-muted-foreground hover:bg-muted",
  },
  IN_PROGRESS: {
    label: "In Progress",
    className: "bg-akomapa-ice text-akomapa-teal hover:bg-akomapa-ice",
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-success/15 text-success hover:bg-success/15",
  },
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const config = statusConfig[status];

  return (
    <Badge
      variant="secondary"
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
};
