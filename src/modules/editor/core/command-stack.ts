import { create } from "zustand";
import type { Command } from "./command";

interface CommandStackState {
  undoStack: Command[];
  redoStack: Command[];
  canUndo: boolean;
  canRedo: boolean;
  execute: (command: Command) => void;
  undo: () => void;
  redo: () => void;
}

// Every editing action goes through here (see PROJECT_PLAN.md §5) so
// undo/redo works uniformly regardless of which tool produced the change.
export const useCommandStack = create<CommandStackState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,

  execute: (command) => {
    command.execute();
    const undoStack = [...get().undoStack, command];
    set({ undoStack, redoStack: [], canUndo: true, canRedo: false });
  },

  undo: () => {
    const { undoStack, redoStack } = get();
    const command = undoStack[undoStack.length - 1];
    if (!command) return;
    command.undo();
    const nextUndo = undoStack.slice(0, -1);
    set({
      undoStack: nextUndo,
      redoStack: [...redoStack, command],
      canUndo: nextUndo.length > 0,
      canRedo: true,
    });
  },

  redo: () => {
    const { undoStack, redoStack } = get();
    const command = redoStack[redoStack.length - 1];
    if (!command) return;
    command.execute();
    const nextRedo = redoStack.slice(0, -1);
    set({
      undoStack: [...undoStack, command],
      redoStack: nextRedo,
      canUndo: true,
      canRedo: nextRedo.length > 0,
    });
  },
}));
