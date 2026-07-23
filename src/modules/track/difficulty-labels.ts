// Shared between every place a track's difficulty is displayed (public track
// page, Discover, creator pages) -- one place to keep the enum's display
// strings in sync with modules/track-format/schema.ts's difficultySchema.
export const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};
