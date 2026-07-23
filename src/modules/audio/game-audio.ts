import * as THREE from "three";
import { createImpactBuffer } from "./impact-sound";
import { createSkidBuffer } from "./skid-sound";
import { RPM_IDLE, RPM_MAX } from "./engine-constants";

function remap(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
}

const NUM_GEARS = 3;
const UPSHIFT_RPM = 0.92;
const DOWNSHIFT_RPM = 0.35;
const SHIFT_COOLDOWN = 0.35;
const SHIFT_CUT = 0.12; // throttle-cut at the start of a shift ("bra-ap braap")

// Collisions below this velocity use the dull-knock buffer set, above it the
// crunch set; velocity also drives per-hit volume and tone up to the ceiling.
const IMPACT_HARD_VELOCITY = 4;
const IMPACT_MAX_VELOCITY = 14;

// Camera follows a few units back; refDistance well below that puts a source
// a little "over there" rather than right at the listener.
const REF_DISTANCE = 7;
const ENGINE_REF_DISTANCE = 11;
const ENGINE_CUTOFF = 5500;

const _listenerPos = new THREE.Vector3();
const _targetPos = new THREE.Vector3();

function distanceCutoff(distance: number): number {
  return THREE.MathUtils.clamp(24000 * Math.pow(6 / Math.max(distance, 6), 1.9), 1200, 24000);
}

// Outdoor "air" impulse response: sparse early reflections + a short dark tail.
function createOutdoorIR(context: BaseAudioContext): AudioBuffer {
  const sr = context.sampleRate;
  const length = Math.floor(1.1 * sr);
  const buffer = context.createBuffer(2, length, sr);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);

    for (let r = 0; r < 8; r++) {
      const t = 0.015 + Math.random() * 0.08;
      const idx = Math.floor(t * sr);
      data[idx] += (Math.random() * 2 - 1) * (0.5 - r * 0.05);
    }

    let lp = 0;
    const lpCoeff = 1 - Math.exp((-2 * Math.PI * 2200) / sr);
    const start = Math.floor(0.05 * sr);

    for (let i = start; i < length; i++) {
      const t = (i - start) / sr;
      lp += (Math.random() * 2 - 1 - lp) * lpCoeff;
      data[i] += lp * Math.exp(-t / 0.32) * 0.35;
    }
  }

  return buffer;
}

interface SampleSource {
  sound: THREE.PositionalAudio;
  tone: BiquadFilterNode;
}

// Adapted from mrdoob's Starter-Kit-Racing's Audio.js (MIT) for TrackForge's
// R3F/Rapier setup -- same engine RPM/gear model and impact design, skid.ogg
// replaced with skid-sound.ts's synthesized loop since this project ships no
// audio assets. `target` is the vehicle's Object3D: every source is a
// PositionalAudio child of it, panned/attenuated relative to the
// camera-mounted listener. Vehicle remounts fresh each time Play mode starts
// (ModeController), so this class is built and torn down (dispose()) to
// match -- otherwise repeated Play sessions would stack up worklet nodes,
// event listeners, and PositionalAudio children on a stale target.
export class GameAudio {
  private listener: THREE.AudioListener | null = null;
  private camera: THREE.Camera | null = null;
  private target: THREE.Object3D | null = null;

  private engineGain: GainNode | null = null;
  private engineRpmParam: AudioParam | null = null;
  private engineLoadParam: AudioParam | null = null;
  private engineNode: AudioWorkletNode | null = null;

  private skidSound: THREE.PositionalAudio | null = null;
  private skidTone: BiquadFilterNode | null = null;

  private impactBuffers: AudioBuffer[] = [];
  private impactPlayers: SampleSource[] = [];
  private impactIndex = 0;

  private distanceFilters: BiquadFilterNode[] = [];
  private unlocked = false;
  private disposed = false;

  private rpm = 0;
  private gear = 0;
  private shiftCooldown = 0;

  private unlock = () => {};
  private handleVisibility = () => {};

  init(camera: THREE.Camera, target: THREE.Object3D) {
    this.camera = camera;
    this.target = target;

    this.listener = new THREE.AudioListener();
    camera.add(this.listener);

    const ctx = this.listener.context;

    const convolver = ctx.createConvolver();
    convolver.buffer = createOutdoorIR(ctx);
    convolver.connect(this.listener.getInput());

    const reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.15;
    reverbSend.connect(convolver);

    const impactReverbSend = ctx.createGain();
    impactReverbSend.gain.value = 0.35;
    impactReverbSend.connect(convolver);

    const engineReverbSend = ctx.createGain();
    engineReverbSend.gain.value = 0.11;
    engineReverbSend.connect(convolver);

    this.initEngine(engineReverbSend).catch((e) => {
      console.warn("Engine synth unavailable:", e);
    });

    const skid = this.createSampleSource(reverbSend);
    this.skidSound = skid.sound;
    this.skidTone = skid.tone;
    this.skidSound.setBuffer(createSkidBuffer(ctx));
    this.skidSound.setLoop(true);
    this.skidSound.setVolume(0);

    for (let i = 0; i < 3; i++) this.impactBuffers.push(createImpactBuffer(ctx, i + 1, 0.4));
    for (let i = 0; i < 3; i++) this.impactBuffers.push(createImpactBuffer(ctx, i + 4, 1.0));
    for (let i = 0; i < 3; i++) this.impactPlayers.push(this.createSampleSource(impactReverbSend));

    this.unlock = () => {
      if (this.unlocked || this.disposed) return;
      this.unlocked = true;

      if (ctx.state === "suspended") ctx.resume();
      if (this.skidSound?.buffer && !this.skidSound.isPlaying) this.skidSound.play();

      window.removeEventListener("keydown", this.unlock);
      window.removeEventListener("click", this.unlock);
      window.removeEventListener("touchstart", this.unlock);
    };

    window.addEventListener("keydown", this.unlock);
    window.addEventListener("click", this.unlock);
    window.addEventListener("touchstart", this.unlock);

    this.handleVisibility = () => {
      if (this.disposed) return;
      if (document.hidden) {
        if (ctx.state === "running") ctx.suspend();
      } else if (this.unlocked && ctx.state === "suspended") {
        ctx.resume();
      }
    };
    document.addEventListener("visibilitychange", this.handleVisibility);
  }

  private async initEngine(engineReverbSend: GainNode) {
    if (!this.listener || !this.target) return;
    const ctx = this.listener.context;

    await ctx.audioWorklet.addModule("/audio/engine-processor.js");
    if (this.disposed) return;

    const node = new AudioWorkletNode(ctx, "engine-sound", {
      numberOfInputs: 0,
      outputChannelCount: [1],
    });

    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    node.connect(this.engineGain);
    this.engineNode = node;

    const tone = this.neutralLowpass();
    tone.frequency.value = ENGINE_CUTOFF;

    const audio = new THREE.PositionalAudio(this.listener);
    audio.setRefDistance(ENGINE_REF_DISTANCE);
    audio.panner.panningModel = "equalpower";
    audio.setFilter(tone);
    audio.setNodeSource(this.engineGain);
    this.target.add(audio);

    this.engineGain.connect(engineReverbSend);

    this.engineRpmParam = node.parameters.get("rpm") ?? null;
    this.engineLoadParam = node.parameters.get("load") ?? null;
  }

  private neutralLowpass(): BiquadFilterNode {
    const filter = this.listener!.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 0.0001;
    filter.frequency.value = 24000;
    return filter;
  }

  private makePositional(filters: BiquadFilterNode[]): THREE.PositionalAudio {
    const audio = new THREE.PositionalAudio(this.listener!);
    audio.setRefDistance(REF_DISTANCE);
    audio.panner.panningModel = "equalpower";
    audio.setFilters(filters);
    this.distanceFilters.push(filters[0]);
    this.target!.add(audio);
    return audio;
  }

  private createSampleSource(reverbSend: GainNode): SampleSource {
    const tone = this.neutralLowpass();
    const audio = this.makePositional([this.neutralLowpass(), tone]);
    audio.gain.connect(reverbSend);
    return { sound: audio, tone };
  }

  update(dt: number, speed: number, throttle: number, driftIntensity: number) {
    if (!this.listener || !this.target) return;

    const absSpeed = THREE.MathUtils.clamp(Math.abs(speed), 0, 1);
    const load = THREE.MathUtils.clamp(Math.max(0, throttle), 0, 1);

    const gearWindow = 1 / NUM_GEARS;
    const gearStart = this.gear * gearWindow;
    const inGear = THREE.MathUtils.clamp((absSpeed - gearStart) / gearWindow, 0, 1);

    let targetRpm = inGear * 0.85 + load * 0.2;
    targetRpm = THREE.MathUtils.clamp(targetRpm, 0, 1.05);

    const riseRate = 4;
    const fallRate = 4;
    const rate = targetRpm > this.rpm ? riseRate * (0.3 + load) : fallRate;
    this.rpm = THREE.MathUtils.lerp(this.rpm, targetRpm, Math.min(1, dt * rate));

    this.shiftCooldown = Math.max(0, this.shiftCooldown - dt);

    if (this.shiftCooldown === 0) {
      if (this.rpm > UPSHIFT_RPM && this.gear < NUM_GEARS - 1 && load > 0.1) {
        this.gear++;
        this.rpm = 0.45;
        this.shiftCooldown = SHIFT_COOLDOWN;
      } else if (this.rpm < DOWNSHIFT_RPM && this.gear > 0) {
        this.gear--;
        this.rpm = 0.78;
        this.shiftCooldown = SHIFT_COOLDOWN;
      }
    }

    const now = this.listener.context.currentTime;

    this.listener.getWorldPosition(_listenerPos);
    this.target.getWorldPosition(_targetPos);
    const cutoff = distanceCutoff(_listenerPos.distanceTo(_targetPos));

    for (const filter of this.distanceFilters) {
      filter.frequency.setTargetAtTime(cutoff, now, 0.1);
    }

    if (this.engineRpmParam && this.engineLoadParam && this.engineGain) {
      const shifting = this.shiftCooldown > SHIFT_COOLDOWN - SHIFT_CUT;

      this.engineRpmParam.value = RPM_IDLE + (RPM_MAX - RPM_IDLE) * this.rpm;
      this.engineLoadParam.value = shifting ? 0 : load;

      const targetVol = remap(absSpeed + load * 0.5, 0, 1.5, 0.06, 0.3);
      this.engineGain.gain.setTargetAtTime(targetVol, now, 0.08);
    }

    if (this.skidSound?.buffer && this.skidTone) {
      const shouldSkid = driftIntensity > 0.5;
      let skidVol = 0;

      if (shouldSkid) {
        skidVol = remap(THREE.MathUtils.clamp(driftIntensity, 0.5, 2.0), 0.5, 2.0, 0.08, 0.35);
      }

      this.skidSound.gain.gain.setTargetAtTime(skidVol, now, 0.05);

      const skidPitch = THREE.MathUtils.clamp(Math.abs(speed), 1, 3);
      const curPitch = this.skidSound.getPlaybackRate();
      this.skidSound.setPlaybackRate(THREE.MathUtils.lerp(curPitch, skidPitch, 0.1));

      const intensity01 = THREE.MathUtils.clamp(remap(driftIntensity, 0.5, 1.6, 0, 1), 0, 1);
      this.skidTone.frequency.setTargetAtTime(2500 + intensity01 * 7500, now, 0.1);
    }
  }

  playImpact(impactVelocity: number) {
    if (!this.unlocked || this.impactPlayers.length === 0) return;

    const { sound, tone } = this.impactPlayers[this.impactIndex % this.impactPlayers.length];
    this.impactIndex++;

    const set = impactVelocity < IMPACT_HARD_VELOCITY ? 0 : 3;
    const buffer = this.impactBuffers[set + ((Math.random() * 3) | 0)];

    if (sound.isPlaying) sound.stop();
    sound.setBuffer(buffer);

    const volume = THREE.MathUtils.clamp(remap(impactVelocity, 0, IMPACT_MAX_VELOCITY, 0.01, 1.0), 0.01, 1.0);
    sound.setVolume(volume);
    sound.setPlaybackRate(0.9 + Math.random() * 0.2);

    const brightness = THREE.MathUtils.clamp(impactVelocity / IMPACT_MAX_VELOCITY, 0, 1);
    tone.frequency.value = (2500 + brightness * 9000) * (0.8 + Math.random() * 0.4);

    sound.play();
    sound.updateMatrixWorld(true);
  }

  dispose() {
    this.disposed = true;

    window.removeEventListener("keydown", this.unlock);
    window.removeEventListener("click", this.unlock);
    window.removeEventListener("touchstart", this.unlock);
    document.removeEventListener("visibilitychange", this.handleVisibility);

    if (this.skidSound?.isPlaying) this.skidSound.stop();
    for (const { sound } of this.impactPlayers) {
      if (sound.isPlaying) sound.stop();
    }

    this.engineNode?.disconnect();
    this.engineGain?.disconnect();

    if (this.camera && this.listener) this.camera.remove(this.listener);
  }
}
