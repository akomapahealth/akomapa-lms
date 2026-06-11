"use client";

import { Button } from "@/components/ui/button";
import { useConfettiStore } from "@/hooks/use-confetti-store";
import { ReflectionPromptModal } from "@/components/modals/reflection-prompt-modal";
import axios from "axios";

import { CheckCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

interface CourseProgressButtonProps {
    topicId: string;
    courseId: string;
    isCompleted?: boolean;
    nextTopicId?: string;
    moduleId?: string;
    reflectionPrompt?: string | null;
}

export const CourseProgressButton = ({
    topicId,
    courseId,
    isCompleted,
    nextTopicId,
    moduleId,
    reflectionPrompt,
}: CourseProgressButtonProps) => {
    const router = useRouter();
    const confetti = useConfettiStore();
    const [isLoading, setIsLoading] = useState(false);
    const [showReflectionModal, setShowReflectionModal] = useState(false);
    const [completedModuleName, setCompletedModuleName] = useState("");

    const onClick = async () => {
        try {
            setIsLoading(true);

            const response = await axios.put(`/api/courses/${courseId}/chapters/${topicId}/progress`, {
                isCompleted: !isCompleted
            });

            // Show badge notifications
            const awardedBadges = response.data.awardedBadges ?? [];
            const hasMilestoneBadge = awardedBadges.some(
                (b: { type: string }) => b.type === "MILESTONE"
            );

            if (!isCompleted && !nextTopicId) {
                // Last topic in the entire course
                confetti.onOpen();
                toast.success("Course completed! Congratulations!");
            } else if (!isCompleted && response.data.isModuleComplete) {
                // Last topic in the current module
                confetti.onOpen();
                toast.success(`Module "${response.data.moduleName}" completed!`);

                // Show reflection prompt if module has one
                if (reflectionPrompt && moduleId) {
                    setCompletedModuleName(response.data.moduleName);
                    setShowReflectionModal(true);
                }
            } else if (!isCompleted) {
                toast.success("Topic completed!");
            }

            // Show badge toasts
            for (const badge of awardedBadges) {
                if (hasMilestoneBadge) confetti.onOpen();
                toast.success(`Badge earned: ${badge.name}!`, {
                    duration: 5000,
                });
            }

            if (!isCompleted && nextTopicId) {
                router.push(`/courses/${courseId}/chapters/${nextTopicId}`);
            }

            router.refresh();
        } catch {
            toast.error("Something went wrong");
        } finally {
            setIsLoading(false);
        }
    }

    const Icon = isCompleted ? XCircle : CheckCircle;
    return (
        <>
            <Button
                onClick={onClick}
                disabled={isLoading}
                type="button"
                variant={isCompleted ? "outline" : "success"}
                className="w-full md:w-auto"
            >
                {isCompleted ? "Not completed" : "Mark as complete"}
                <Icon className="h-4 w-4 ml-2"/>
            </Button>
            {reflectionPrompt && moduleId && (
                <ReflectionPromptModal
                    isOpen={showReflectionModal}
                    onClose={() => setShowReflectionModal(false)}
                    moduleName={completedModuleName}
                    prompt={reflectionPrompt}
                    courseId={courseId}
                    moduleId={moduleId}
                />
            )}
        </>
    )
}
