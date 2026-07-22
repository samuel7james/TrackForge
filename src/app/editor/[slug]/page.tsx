import { EditorView } from "@/modules/editor/editor-view";

interface ExistingTrackEditorPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ExistingTrackEditorPage({
  params,
}: ExistingTrackEditorPageProps) {
  const { slug } = await params;
  return <EditorView slug={slug} />;
}
