"use client";

import { useSyncExternalStore } from "react";
import {
  getBookmarks,
  isBookmarked,
  subscribeToBookmarks,
  type BookmarkEntry,
} from "./bookmarks-storage";

const emptyBookmarks: BookmarkEntry[] = [];

export function useBookmarks(): BookmarkEntry[] {
  return useSyncExternalStore(
    subscribeToBookmarks,
    getBookmarks,
    () => emptyBookmarks
  );
}

export function useIsBookmarked(slug: string): boolean {
  return useSyncExternalStore(
    subscribeToBookmarks,
    () => isBookmarked(slug),
    () => false
  );
}
