// Fixed-angle chase camera with velocity-lead deadzone smoothing: the car
// settles at the trailing edge of an invisible circle around the camera's
// look target, so straight-line speed pulls the framing slightly ahead
// without the camera itself ever losing the car. `dispose()` is a TrackForge
// addition (the original assumes it owns the whole page for its lifetime) so
// the resize listener doesn't leak across React mount/unmount cycles.
import * as THREE from "three";

const _desired = new THREE.Vector3();
const _delta = new THREE.Vector3();
const _lookPoint = new THREE.Vector3();
const _chaseForward = new THREE.Vector3();

export class Camera {
  camera: THREE.PerspectiveCamera;
  offset: THREE.Vector3;
  camRightXZ: THREE.Vector3;
  camForwardXZ: THREE.Vector3;

  leadFactor = 3.0;
  cameraSmoothing = 2.0;
  deadzoneRadius = 5.0;
  screenShiftUp = 1.0;

  smoothedDesired = new THREE.Vector3();
  initialized = false;

  // Alternate mode (see updateChase below) -- a conventional
  // heading-relative third-person chase, closer and lower than the fixed
  // 45°-azimuth "Godot View" the default `update()` uses. Kept as separate
  // state/method rather than branching inside `update()` so the default
  // camera path is entirely untouched. Toggled at runtime with the C key
  // (see engine-core.ts); starts off, and isn't persisted between sessions.
  chaseMode = false;
  chaseDistance = 7.5;
  chaseHeight = 3.6;
  chaseLookAhead = 5;
  chaseLookHeight = 1.2;
  chaseSmoothing = 6.0;
  // Slower than chaseSmoothing on purpose: the vehicle's heading itself
  // (container.quaternion) can swing fast through a sharp corner or a
  // drift, and following that instantaneous heading directly whipped the
  // view around every time -- smoothing the heading (not just the
  // position) the camera looks from/at is what actually calms that down.
  chaseRotSmoothing = 3.5;
  smoothedChasePos = new THREE.Vector3();
  smoothedChaseQuat = new THREE.Quaternion();
  chaseInitialized = false;

  debug: THREE.Line;

  private handleResize: () => void;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 60);

    // Matches Godot View: 45° azimuth, 35° elevation, distance 16
    this.offset = new THREE.Vector3(9.27, 9.18, 9.27);

    this.camera.position.copy(this.offset);
    this.camera.lookAt(0, 0, 0);

    // Camera-aligned ground basis (XZ plane), derived from offset.
    // camRightXZ: screen-right projected to ground.
    // camForwardXZ: screen-up (away from camera) projected to ground.
    this.camRightXZ = new THREE.Vector3(this.offset.z, 0, -this.offset.x).normalize();
    this.camForwardXZ = new THREE.Vector3(-this.offset.x, 0, -this.offset.z).normalize();

    const segments = 64;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
    }
    const dzGeom = new THREE.BufferGeometry().setFromPoints(points);
    this.debug = new THREE.Line(dzGeom, new THREE.LineBasicMaterial({ color: 0xff00ff, depthTest: false }));
    this.debug.visible = false;
    this.debug.renderOrder = 999;
    this.debug.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(this.camRightXZ, new THREE.Vector3(0, 1, 0), this.camForwardXZ)
    );

    this.handleResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", this.handleResize);
  }

  update(dt: number, target: THREE.Vector3, velocity: THREE.Vector3) {
    const radius = this.deadzoneRadius;
    const radiusSq = radius * radius;

    // Lead = velocity projected onto camera-aligned ground basis, scaled, clamped to the deadzone disk.
    // Becomes the camera's offset from the car: car settles at the trailing edge of the circle.
    let leadX = velocity.dot(this.camRightXZ) * this.leadFactor;
    let leadY = velocity.dot(this.camForwardXZ) * this.leadFactor;
    const leadLenSq = leadX * leadX + leadY * leadY;
    if (leadLenSq > radiusSq) {
      const k = radius / Math.sqrt(leadLenSq);
      leadX *= k;
      leadY *= k;
    }

    _desired.copy(target).addScaledVector(this.camRightXZ, leadX).addScaledVector(this.camForwardXZ, leadY);

    const alpha = this.initialized ? 1 - Math.exp(-dt * this.cameraSmoothing) : 1;
    this.smoothedDesired.lerp(_desired, alpha);
    this.initialized = true;

    // Hard-clamp: car must not escape the deadzone, even if the lerp lags at high speed.
    _delta.subVectors(target, this.smoothedDesired);
    const offsetX = _delta.dot(this.camRightXZ);
    const offsetY = _delta.dot(this.camForwardXZ);
    const offsetLenSq = offsetX * offsetX + offsetY * offsetY;
    if (offsetLenSq > radiusSq) {
      const offsetLen = Math.sqrt(offsetLenSq);
      const k = (offsetLen - radius) / offsetLen;
      this.smoothedDesired
        .addScaledVector(this.camRightXZ, offsetX * k)
        .addScaledVector(this.camForwardXZ, offsetY * k);
    }

    // Shift the entire view (camera + lookAt) so smoothedDesired sits higher on screen.
    _lookPoint.copy(this.smoothedDesired).addScaledVector(this.camForwardXZ, -this.screenShiftUp);

    this.camera.position.copy(_lookPoint).add(this.offset);
    this.camera.lookAt(_lookPoint);

    this.debug.position.copy(this.smoothedDesired);
    this.debug.position.y += 0.05;
    this.debug.scale.set(radius, 1, radius);
  }

  // Each mode smooths toward its own independently-stored position, and the
  // inactive one's keeps drifting out of date while the other is driving --
  // so entering a mode re-arms its "first frame" flag, making that frame
  // snap straight to the correct framing. Without this the view glides in
  // from wherever that camera was last left pointing, several corners ago.
  setChaseMode(enabled: boolean) {
    if (enabled === this.chaseMode) return;
    this.chaseMode = enabled;
    if (enabled) this.chaseInitialized = false;
    else this.initialized = false;
  }

  // Follows behind the vehicle's actual heading (rotates as the car turns),
  // unlike the fixed-compass-direction `update()` above -- closer and lower
  // too, matching the over-the-shoulder framing of a typical AAA racer
  // rather than the default's pulled-back isometric-style view. Both the
  // heading used to place/aim the camera and the camera's position are
  // smoothed independently (different rates) -- smoothing position alone
  // wasn't enough, since the *look direction* still snapped to the car's
  // instantaneous heading and whipped around on sharp corners/drifts.
  updateChase(dt: number, target: THREE.Vector3, quaternion: THREE.Quaternion) {
    if (!this.chaseInitialized) {
      this.smoothedChaseQuat.copy(quaternion);
    } else {
      const rotAlpha = 1 - Math.exp(-dt * this.chaseRotSmoothing);
      this.smoothedChaseQuat.slerp(quaternion, rotAlpha);
    }

    _chaseForward.set(0, 0, 1).applyQuaternion(this.smoothedChaseQuat);

    _desired.copy(target).addScaledVector(_chaseForward, -this.chaseDistance);
    _desired.y += this.chaseHeight;

    const alpha = this.chaseInitialized ? 1 - Math.exp(-dt * this.chaseSmoothing) : 1;
    this.smoothedChasePos.lerp(_desired, alpha);
    this.chaseInitialized = true;

    this.camera.position.copy(this.smoothedChasePos);

    _lookPoint.copy(target).addScaledVector(_chaseForward, this.chaseLookAhead);
    _lookPoint.y += this.chaseLookHeight;
    this.camera.lookAt(_lookPoint);
  }

  dispose() {
    window.removeEventListener("resize", this.handleResize);
  }
}
