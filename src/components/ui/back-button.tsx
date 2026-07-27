"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "./button";
import { hasInAppHistory } from "@/lib/navigation-history";

// Browser-history back, not a fixed href -- "the page you came from" isn't
// always the same place (Discover, a bookmark, a shared link), so a real
// back navigation is the only thing that's correct regardless of entry
// point. Shown on every page except the homepage, which has nowhere
// further back to go within the app.
//
// Falls back to Home when there's no in-app history to go back to (this
// page was opened directly -- a shared link, bookmark, or new tab):
// router.back() in that case doesn't error, it just navigates to whatever
// (if anything) preceded this tab's very first load, which can land on a
// blank page or do nothing at all -- either way looking exactly like a
// broken button, not a graceful no-op.
export function BackButton() {
  const router = useRouter();

  const handleClick = () => {
    if (hasInAppHistory()) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleClick} aria-label="Go back">
      <ArrowLeft className="size-4" />
    </Button>
  );
}
