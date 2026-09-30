import { requirePagePrincipal } from "@/lib/auth";
import { entitledCourseIds } from "@/lib/entitlement";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { db } from "@/lib/db";
import { CreatePostForm } from "./_components/create-post-form";

const NewPostPage = async () => {
  const principal = await requirePagePrincipal("/sign-in");

  // The Courses they may actually learn, not the ones they have ever paid for. A
  // suspended learner should not be able to associate a new post with the Course
  // they are suspended from.
  const courseIds = await entitledCourseIds(principal);

  const [categories, courses] = await Promise.all([
    db.forumCategory.findMany({ orderBy: { position: "asc" } }),
    courseIds.length === 0
      ? Promise.resolve([])
      : db.course.findMany({
          where: { id: { in: courseIds } },
          select: { id: true, title: true },
          orderBy: { title: "asc" },
        }),
  ]);

  return (
    <div className="px-4 py-6 sm:p-6 max-w-3xl mx-auto space-y-6">
      <Link
        href="/community"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-akomapa-teal transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Community
      </Link>

      <h1 className="text-xl sm:text-2xl font-bold text-foreground">Create a New Post</h1>

      <CreatePostForm categories={categories} courses={courses} />
    </div>
  );
};

export default NewPostPage;
