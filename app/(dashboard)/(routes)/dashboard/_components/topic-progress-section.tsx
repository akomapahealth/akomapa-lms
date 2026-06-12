import { Card } from "@/components/ui/card";
import { CourseProgress } from "@/components/course-progress";
import { type ModuleProgressBreakdown } from "@/actions/get-course-progress-breakdown";

interface TopicProgressSectionProps {
  modules: ModuleProgressBreakdown[];
}

export const TopicProgressSection = ({
  modules,
}: TopicProgressSectionProps) => {
  return (
    <Card className="p-4">
      <h3 className="font-semibold text-sm text-foreground mb-3">
        Topic Progress ({modules.length})
      </h3>
      {modules.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No modules yet
        </p>
      ) : (
        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
          {modules.map((mod) => (
            <div key={mod.moduleId}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-foreground truncate mr-2">
                  {mod.moduleTitle}
                </p>
                <span className="text-sm font-semibold text-success shrink-0">
                  {mod.percentage}%
                </span>
              </div>
              <CourseProgress value={mod.percentage} size="sm" />
              <p className="text-xs text-muted-foreground mt-0.5">
                {mod.completedTopics}/{mod.totalTopics} items completed
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
