"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Rocket } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTrackStore } from "@/store/track-store";
import { useUiStore } from "@/store/ui-store";
import { useTrackValidation } from "@/modules/track-format/hooks";
import { useSaveTrack } from "@/modules/track-format/use-save-track";
import { editTokenStorageKey } from "@/modules/track-format/use-save-track";
import type { Difficulty } from "@/modules/track-format/schema";

const MAX_TAGS = 5;

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "expert", label: "Expert" },
];

export function PublishDialog() {
  const open = useUiStore((s) => s.isPublishDialogOpen);
  const setOpen = useUiStore((s) => s.setPublishDialogOpen);
  const [isPublishing, setIsPublishing] = useState(false);
  const meta = useTrackStore((s) => s.document.meta);
  const setMeta = useTrackStore((s) => s.setMeta);
  const { isValid, issues } = useTrackValidation();
  const saveTrack = useSaveTrack();

  const [name, setName] = useState(meta.name);
  const [description, setDescription] = useState(meta.description);
  const [difficulty, setDifficulty] = useState<Difficulty>(meta.difficulty);
  const [tagsInput, setTagsInput] = useState(meta.tags.join(", "));

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setName(meta.name);
      setDescription(meta.description);
      setDifficulty(meta.difficulty);
      setTagsInput(meta.tags.join(", "));
    }
    setOpen(nextOpen);
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag, index, all) => tag.length > 0 && all.indexOf(tag) === index)
        .slice(0, MAX_TAGS);
      setMeta({ name: name.trim() || "Untitled Track", description, difficulty, tags });
      await saveTrack();

      const slug = useTrackStore.getState().document.meta.slug;
      const editToken = slug ? localStorage.getItem(editTokenStorageKey(slug)) : null;
      if (!slug || !editToken) {
        throw new Error("Couldn't verify edit permissions for this track");
      }

      const res = await fetch(`/api/tracks/${slug}/publish`, {
        method: "POST",
        headers: { "X-Edit-Token": editToken },
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error ?? "Failed to publish track");
      }

      toast.success("Track published", { description: `/t/${slug}` });
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to publish track");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Rocket className="size-4" />
        Publish
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish track</DialogTitle>
          <DialogDescription>
            {isValid
              ? "Set the details other racers will see."
              : issues.map((issue) => issue.message).join(" ")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="publish-name" className="mb-1 block text-xs text-muted-foreground">
              Name
            </Label>
            <Input
              id="publish-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
          </div>
          <div>
            <Label
              htmlFor="publish-description"
              className="mb-1 block text-xs text-muted-foreground"
            >
              Description
            </Label>
            <Textarea
              id="publish-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={280}
              rows={3}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Difficulty</Label>
            <Select
              value={difficulty}
              onValueChange={(value) => setDifficulty(value as Difficulty)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="publish-tags" className="mb-1 block text-xs text-muted-foreground">
              Tags (comma-separated, up to {MAX_TAGS})
            </Label>
            <Input
              id="publish-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="drift, hillclimb, technical"
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handlePublish} disabled={!isValid || isPublishing}>
            {isPublishing ? "Publishing…" : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
