import { Suspense } from "react";
import { EditorView } from "@/modules/editor/editor-view";
import { isAdminSessionValid } from "@/lib/admin-auth";

interface ExistingTrackEditorPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ExistingTrackEditorPage({
  params,
}: ExistingTrackEditorPageProps) {
  const { slug } = await params;
  // Checked server-side (the admin cookie isn't readable client-side) so an
  // admin gets full edit rights on any track, not just their own -- the API
  // routes are the real boundary (see route.ts's own isAdminSessionValid
  // check), this only decides whether the editor UI should even try.
  const isAdmin = await isAdminSessionValid();
  return (
    <Suspense fallback={null}>
      <EditorView slug={slug} isAdmin={isAdmin} />
    </Suspense>
  );
}
