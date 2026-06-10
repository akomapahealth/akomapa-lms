"use client";

import { Button } from "@/components/ui/button";
import { useConfettiStore } from "@/hooks/use-confetti-store";
import axios from "axios";

import { CheckCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

interface CourseProgressButtonProps {
    topicId: string;
    courseId: string;
    isCompleted?: boolean
    nextTopicId?: string;
}

export const CourseProgressButton = ({
    topicId,
    courseId,
    isCompleted,
    nextTopicId,
}: CourseProgressButtonProps) => {
    const router = useRouter();
    const confetti = useConfettiStore();
    const [isLoading, setIsLoading] = useState(false);

    const onClick = async () => {
        try {
            setIsLoading(true);

            await axios.put(`/api/courses/${courseId}/chapters/${topicId}/progress`, {
                isCompleted: !isCompleted
            });

            // Trigger confetti when completing the last topic (no next topic)
            if (!isCompleted && !nextTopicId) {
                confetti.onOpen();
                toast.success("Course completed! Congratulations!");
            } else if (!isCompleted) {
                toast.success("Topic completed!");
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
    )
}
