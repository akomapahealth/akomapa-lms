import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { db } from "@/lib/db";
import { CreatePostForm } from "./_components/create-post-form";

const NewPostPage = async () => {
  const { userId } = await auth();
  if (!userId) return redirect("/sign-in");

  const [categories, enrolledCourses] = await Promise.all([
    db.forumCategory.findMany({ orderBy: { position: "asc" } }),
    db.purchase.findMany({
      where: { userId },
      select: {
        course: { select: { id: true, title: true } },
      },
    }),
  ]);

  const courses = enrolledCourses.map((p) => p.course);

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
