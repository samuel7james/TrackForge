import { Suspense } from "react";
import { EditorView } from "@/modules/editor/editor-view";

interface ExistingTrackEditorPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ExistingTrackEditorPage({
  params,
}: ExistingTrackEditorPageProps) {
  const { slug } = await params;
  return (
    <Suspense fallback={null}>
      <EditorView slug={slug} />
    </Suspense>
  );
}
