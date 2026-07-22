import { Suspense } from "react";
import { EditorView } from "@/modules/editor/editor-view";

export default function NewTrackEditorPage() {
  return (
    <Suspense fallback={null}>
      <EditorView slug={null} />
    </Suspense>
  );
}
