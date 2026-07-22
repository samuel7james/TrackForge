"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FilePlus, Pencil, Play, Rocket, Save } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { useEditorStore } from "@/store/editor-store";
import { useUiStore } from "@/store/ui-store";
import { useSaveTrack } from "@/modules/track-format/use-save-track";

export function CommandPalette() {
  const open = useUiStore((s) => s.isCommandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const setPublishDialogOpen = useUiStore((s) => s.setPublishDialogOpen);
  const mode = useEditorStore((s) => s.mode);
  const toggleMode = useEditorStore((s) => s.toggleMode);
  const saveTrack = useSaveTrack();
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command>
        <CommandInput placeholder="Type a command..." />
        <CommandList>
          <CommandEmpty>No matching command.</CommandEmpty>
          <CommandGroup heading="Track">
            <CommandItem onSelect={() => run(() => router.push("/editor/new"))}>
              <FilePlus />
              New track
            </CommandItem>
            <CommandItem
              onSelect={() =>
                run(() => {
                  void saveTrack()
                    .then(() => toast.success("Track saved"))
                    .catch((error: unknown) =>
                      toast.error(error instanceof Error ? error.message : "Failed to save track"),
                    );
                })
              }
            >
              <Save />
              Save
              <CommandShortcut>⌘S</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => run(() => setPublishDialogOpen(true))}>
              <Rocket />
              Publish
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Mode">
            <CommandItem onSelect={() => run(toggleMode)}>
              {mode === "edit" ? <Play /> : <Pencil />}
              {mode === "edit" ? "Switch to Play" : "Switch to Edit"}
              <CommandShortcut>Esc</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
