// Mirrors the RPM range baked into public/audio/engine-processor.js -- that
// file is a plain script fetched by URL for audioWorklet.addModule(), not
// something this TS module graph can import, so the two constants have to be
// kept in sync by hand. Used here only to map the 0..1 gear model onto real
// RPM values before handing them to the worklet's `rpm` AudioParam.
export const RPM_IDLE = 1000;
export const RPM_MAX = 6700;
