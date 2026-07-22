"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSaveTrack } from "@/modules/track-format/use-save-track";

export function SaveButton() {
  const saveTrack = useSaveTrack();
  const [isSaving, setIsSaving] = useState(false);

  const handleClick = async () => {
    setIsSaving(true);
    try {
      await saveTrack();
      toast.success("Track saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save track");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={isSaving} className="gap-1.5">
      {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
      Save
    </Button>
  );
}
