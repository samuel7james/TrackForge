const ADJECTIVES = [
  "swift",
  "crimson",
  "silver",
  "shadow",
  "golden",
  "azure",
  "rapid",
  "electric",
  "midnight",
  "amber",
  "hollow",
  "velvet",
  "iron",
  "neon",
  "wild",
];

const NOUNS = [
  "canyon",
  "circuit",
  "falcon",
  "harbor",
  "summit",
  "raceway",
  "delta",
  "horizon",
  "vortex",
  "switchback",
  "hairpin",
  "straightaway",
  "chicane",
  "apex",
  "ridge",
];

// Human-readable slugs (e.g. "swift-falcon-x7k2") in the spirit of the
// eventual published URL format (trackforge.app/t/alpine-touge) — nicer
// than a bare id from the moment a track is first saved.
export function generateSlug(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${adjective}-${noun}-${suffix}`;
}
