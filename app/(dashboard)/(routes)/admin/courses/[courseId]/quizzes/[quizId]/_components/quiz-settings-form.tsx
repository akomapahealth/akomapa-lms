"use client";

import * as z from "zod";
import axios from "axios";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Pencil } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { QUIZ_TYPE_LABELS, QUIZ_TYPES, QuizType } from "@/lib/domain/states";
import { apiErrorMessage } from "@/lib/api-error-message";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface QuizSettingsFormProps {
  initialData: {
    type: QuizType;
    timeLimitMinutes: number | null;
    passingScore: number;
  };
  courseId: string;
  quizId: string;
}

const formSchema = z.object({
  type: z.nativeEnum(QuizType),
  timeLimitMinutes: z.coerce.number().min(1).nullable(),
  passingScore: z.coerce.number().min(0).max(100),
});

export const QuizSettingsForm = ({
  initialData,
  courseId,
  quizId,
}: QuizSettingsFormProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const toggleEdit = () => setIsEditing((c) => !c);
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: initialData.type,
      timeLimitMinutes: initialData.timeLimitMinutes,
      passingScore: initialData.passingScore,
    },
  });

  const { isSubmitting, isValid } = form.formState;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await axios.patch(`/api/courses/${courseId}/quizzes/${quizId}`, values);
      toast.success("Quiz settings updated!");
      toggleEdit();
      router.refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Something went wrong"));
    }
  };

  return (
    <div className="mt-6 border bg-muted rounded-md p-4">
      <div className="font-medium flex items-center justify-between">
        Quiz Settings
        <Button onClick={toggleEdit} variant="ghost">
          {isEditing ? "Cancel" : (
            <>
              <Pencil className="h-4 w-4 mr-2" />
              Edit settings
            </>
          )}
        </Button>
      </div>
      {!isEditing && (
        <div className="text-sm mt-2 space-y-1">
          <p>Type: {QUIZ_TYPE_LABELS[initialData.type]}</p>
          <p>
            Time Limit:{" "}
            {initialData.timeLimitMinutes
              ? `${initialData.timeLimitMinutes} minutes`
              : "No limit"}
          </p>
          <p>Passing Score: {initialData.passingScore}%</p>
        </div>
      )}
      {isEditing && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {QUIZ_TYPES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {QUIZ_TYPE_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="timeLimitMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time Limit (minutes)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      disabled={isSubmitting}
                      placeholder="e.g. 30"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="passingScore"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Passing Score (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      disabled={isSubmitting}
                      placeholder="e.g. 70"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button disabled={!isValid || isSubmitting} type="submit">
              Save
            </Button>
          </form>
        </Form>
      )}
    </div>
  );
};
