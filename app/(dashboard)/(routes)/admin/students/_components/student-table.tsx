"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { timeAgo } from "@/lib/utils";

interface StudentRow {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  imageUrl: string | null;
  role: string;
  enrolledCourses: number;
  overallProgress: number;
  createdAt: Date;
}

interface StudentTableProps {
  students: StudentRow[];
}

export const StudentTable = ({ students }: StudentTableProps) => {
  const [search, setSearch] = useState("");

  const filtered = students.filter((student) => {
    const name = [student.firstName, student.lastName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const email = (student.email ?? "").toLowerCase();
    const query = search.toLowerCase();
    return name.includes(query) || email.includes(query);
  });

  const getInitials = (firstName: string | null, lastName: string | null) => {
    const f = firstName?.[0] ?? "";
    const l = lastName?.[0] ?? "";
    return (f + l).toUpperCase() || "?";
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 max-w-sm"
        />
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-center">Enrolled Courses</TableHead>
              <TableHead className="text-center">Overall Progress</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                  {search ? "No students match your search" : "No students yet"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {student.imageUrl && (
                          <AvatarImage src={student.imageUrl} alt="" />
                        )}
                        <AvatarFallback className="text-xs">
                          {getInitials(student.firstName, student.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">
                        {[student.firstName, student.lastName]
                          .filter(Boolean)
                          .join(" ") || "Anonymous"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {student.email ?? "-"}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {student.enrolledCourses}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {student.overallProgress}%
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {student.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {timeAgo(student.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
