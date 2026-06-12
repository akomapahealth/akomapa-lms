"use client";

import { Lock, Globe, BookOpen, Calendar } from "lucide-react";
import Link from "next/link";

interface JournalEntry {
  id: string;
  title: string;
  content: string;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
  course: { id: string; title: string } | null;
  module: { id: string; title: string } | null;
}

interface JournalListProps {
  entries: JournalEntry[];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

export const JournalList = ({ entries }: JournalListProps) => {
  if (entries.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-border rounded-lg">
        <BookOpen className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-muted-foreground text-lg font-medium">
          No journal entries yet
        </p>
        <p className="text-muted-foreground/70 text-sm mt-1">
          Write your first reflection to get started
        </p>
        <Link
          href="/journal/new"
          className="inline-flex items-center mt-4 px-4 py-2 bg-akomapa-teal text-white text-sm font-medium rounded-md hover:bg-akomapa-teal-dark transition"
        >
          Write a Reflection
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <Link
          key={entry.id}
          href={`/journal/${entry.id}`}
          className="block border rounded-lg p-4 hover:shadow-sm hover:border-akomapa-teal/30 transition bg-card"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {entry.title}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                {entry.course && (
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    {entry.course.title}
                  </span>
                )}
                {entry.module && (
                  <span>· {entry.module.title}</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {stripHtml(entry.content)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
                <Calendar className="w-3 h-3" />
                {new Date(entry.updatedAt).toLocaleDateString()}
              </div>
              {entry.isPrivate ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground/70">
                  <Lock className="w-3 h-3" /> Private
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-success">
                  <Globe className="w-3 h-3" /> Shared
                </span>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};
