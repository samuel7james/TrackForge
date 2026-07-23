import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTHOR_ID_COOKIE } from "@/lib/anonymous-id";
import { Button } from "@/components/ui/button";
import { PublicNav } from "@/modules/track/public-nav";

// authorId is only ever set by POST /api/tracks (Route Handlers can set
// cookies, this page can't) -- a browser that's never saved a track has no
// cookie yet, so there's no authorId to redirect to. That's the empty state
// below, not an error.
export default async function MyTracksPage() {
  const authorId = (await cookies()).get(AUTHOR_ID_COOKIE)?.value;
  if (authorId) redirect(`/creator/${authorId}`);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            TrackForge
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">My tracks</h1>
        </div>
        <PublicNav current="/my-tracks" />
      </div>
      <div className="flex flex-col items-center gap-4 py-16 text-center text-muted-foreground">
        <p>You haven&apos;t created any tracks yet.</p>
        <Button nativeButton={false} render={<Link href="/editor/new" />}>
          Create a track
        </Button>
      </div>
    </div>
  );
}
