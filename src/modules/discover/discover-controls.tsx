"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Flame, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DiscoverControlsProps {
  sort: "new" | "played";
  query: string;
}

const SORT_OPTIONS = [
  { value: "new", label: "Newest", icon: Clock },
  { value: "played", label: "Most played", icon: Flame },
] as const;

// A plain GET form (rather than fetch + client-side list state) so sort and
// search both just become URL query params -- the server component re-runs
// the Prisma query on navigation, no separate client-side data layer needed.
export function DiscoverControls({ sort, query }: DiscoverControlsProps) {
  const router = useRouter();
  const [search, setSearch] = useState(query);

  const navigate = (nextSort: string, nextQuery: string) => {
    const params = new URLSearchParams();
    if (nextSort !== "new") params.set("sort", nextSort);
    if (nextQuery) params.set("q", nextQuery);
    const qs = params.toString();
    router.push(qs ? `/discover?${qs}` : "/discover");
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-1.5">
        {SORT_OPTIONS.map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            size="sm"
            variant={sort === value ? "default" : "outline"}
            className="gap-1.5"
            onClick={() => navigate(value, search)}
          >
            <Icon className="size-3.5" />
            {label}
          </Button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate(sort, search);
        }}
        className="relative w-full sm:w-64"
      >
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tracks..."
          className="pl-8"
        />
      </form>
    </div>
  );
}
