"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "./button";

// Browser-history back, not a fixed href -- "the page you came from" isn't
// always the same place (Discover, a bookmark, a shared link), so a real
// back navigation is the only thing that's correct regardless of entry
// point. Shown on every page except the homepage, which has nowhere
// further back to go within the app.
export function BackButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => router.back()}
      aria-label="Go back"
    >
      <ArrowLeft className="size-4" />
    </Button>
  );
}
