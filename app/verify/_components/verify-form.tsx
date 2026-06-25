"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const VerifyForm = () => {
  const router = useRouter();
  const [value, setValue] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    router.push(`/verify/${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={onSubmit} className="mt-6 flex gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="GHELP-2026-00042"
        className="font-mono"
        aria-label="Certificate number"
      />
      <Button type="submit" disabled={!value.trim()}>
        <Search className="mr-2 h-4 w-4" aria-hidden />
        Verify
      </Button>
    </form>
  );
};
