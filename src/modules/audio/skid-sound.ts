// Procedural tire-scrub loop -- Starter-Kit-Racing plays a recorded
// audio/skid.ogg sample for this; TrackForge has no audio assets at all
// (CarModel, props, everything else here is procedural geometry/sound, see
// prop-registry.ts), so this synthesizes an equivalent instead of adding the
// project's first binary asset. A short bandpass-filtered noise loop reads
// as a scrape/hiss regardless of loop length (noise has no pitch to expose a
// seam), so only the loop *edges* need matching -- crossfaded here so the
// wrap doesn't click. GameAudio drives its tone/volume/pitch live per frame,
// same as it would a sample.
const DURATION = 0.5;
const CROSSFADE = 0.03;

export function createSkidBuffer(context: BaseAudioContext): AudioBuffer {
  const sampleRate = context.sampleRate;
  const length = Math.floor(DURATION * sampleRate);
  const buffer = context.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  let seed = 7331;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) | 0;
    return (seed >>> 9) / 8388608;
  };

  // Bandpass around the "tire on tarmac" scrape band, textured with a slow
  // amplitude wobble so it doesn't read as a perfectly flat drone.
  const svfF = 2 * Math.sin((Math.PI * 3200) / sampleRate);
  const svfQ = 0.7;
  let low = 0;
  let band = 0;

  let wobble = 0;
  const wobbleCoeff = 1 - Math.exp((-2 * Math.PI * 8) / sampleRate);

  for (let i = 0; i < length; i++) {
    const white = random() * 2 - 1;
    low += svfF * band;
    const high = white - low - svfQ * band;
    band += svfF * high;

    wobble += (random() * 2 - 1 - wobble) * wobbleCoeff;
    data[i] = band * (0.8 + wobble * 0.2);
  }

  // Normalize, then crossfade the tail into the head so buffer.loop = true
  // doesn't click at the seam.
  let peak = 0;
  for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak > 0) {
    const norm = 0.85 / peak;
    for (let i = 0; i < length; i++) data[i] *= norm;
  }

  const fadeSamples = Math.floor(CROSSFADE * sampleRate);
  for (let i = 0; i < fadeSamples; i++) {
    const t = i / fadeSamples;
    const headIdx = i;
    const tailIdx = length - fadeSamples + i;
    const mixed = data[tailIdx] * (1 - t) + data[headIdx] * t;
    data[headIdx] = mixed;
    data[tailIdx] = mixed;
  }

  return buffer;
}
