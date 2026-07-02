// Physics simulation for Naan (Frisbee) and Baguette (Spear)

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface FlightState {
  position: Vector3D;
  velocity: Vector3D;
  rotation: Vector3D; // pitch, yaw, roll (in radians)
  spin: number;       // spin rate (rad/s)
  isActive: boolean;
  isStuck: boolean;
  distance: number;
  maxHeight: number;
  maxSpeed: number;
  time: number;
  trail: Vector3D[];
}

export interface WindState {
  x: number;
  y: number;
  z: number;
}

const GRAVITY = 9.81; // m/s^2
const RHO = 1.225;    // air density at sea level (kg/m^3)

// Vector helper functions
function magnitude(v: Vector3D): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function normalize(v: Vector3D): Vector3D {
  const len = magnitude(v);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function dot(a: Vector3D, b: Vector3D): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vector3D, b: Vector3D): Vector3D {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function add(a: Vector3D, b: Vector3D): Vector3D {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function subtract(a: Vector3D, b: Vector3D): Vector3D {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function multiplyScalar(v: Vector3D, s: number): Vector3D {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

// Convert Euler rotation (pitch, yaw, roll) to a forward and normal vector
function getAxesFromRotation(rotation: Vector3D) {
  const { x: pitch, y: yaw, z: roll } = rotation;

  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);

  // Normal vector: perpendicular to flat disc face (pointing UP)
  // Initially (0,1,0), rotated by Roll (around Z), Pitch (around X), Yaw (around Y)
  const normal = {
    x: -cr * sp * sy - sr * cy,
    y: cr * cp,
    z: -cr * sp * cy + sr * sy
  };

  // Forward vector: pointing along the nose (pointing FORWARD)
  // Initially (0,0,1), rotated by Roll (around Z), Pitch (around X), Yaw (around Y)
  const forward = {
    x: cp * sy,
    y: sp,
    z: cp * cy
  };

  return { normal, forward };
}

export function createInitialState(
  launchAngleDeg: number,
  launchSpeedMs: number,
  launchHeightM: number,
  spinRps: number,
  sideAngleDeg: number = 0
): FlightState {
  const pitch = (launchAngleDeg * Math.PI) / 180;
  const yaw = -(sideAngleDeg * Math.PI) / 180;
  
  // Velocity vector
  const vx = launchSpeedMs * Math.sin(yaw) * Math.cos(pitch);
  const vy = launchSpeedMs * Math.sin(pitch);
  const vz = launchSpeedMs * Math.cos(yaw) * Math.cos(pitch);

  const pos = { x: 0, y: launchHeightM, z: 0 };

  return {
    position: pos,
    velocity: { x: vx, y: vy, z: vz },
    rotation: { x: pitch, y: yaw, z: 0 },
    spin: spinRps * 2 * Math.PI, // convert rev/s to rad/s
    isActive: true,
    isStuck: false,
    distance: 0,
    maxHeight: launchHeightM,
    maxSpeed: launchSpeedMs,
    time: 0,
    trail: [{ ...pos }]
  };
}

export function updateFlightStep(
  state: FlightState,
  dt: number,
  type: 'naan' | 'baguette',
  wind: WindState
): FlightState {
  if (!state.isActive) return state;

  // Get current attributes
  let pos = { ...state.position };
  let vel = { ...state.velocity };
  let rot = { ...state.rotation };
  let spin = state.spin;

  // 1. Relative velocity (projectile velocity relative to wind)
  const velRel = subtract(vel, wind);
  const speedRel = magnitude(velRel);

  // Constants based on weapon
  let mass = 0.15; // kg
  let area = 0.07; // m^2
  let force = { x: 0, y: 0, z: 0 };

  // Gravity Force
  const fGravity = { x: 0, y: -GRAVITY * mass, z: 0 };
  force = add(force, fGravity);

  if (speedRel > 0.01) {
    const dirRel = normalize(velRel);

    if (type === 'naan') {
      // --- Naan Frisbee Physics ---
      mass = 0.14; // lighter
      area = 0.065; // disc area (diameter ~28cm)

      const { normal } = getAxesFromRotation(rot);

      // Angle of attack (alpha) is the angle between velocity vector and the disc plane.
      // Since normal vector tilts backwards when nose is pitched up, we want: alpha = theta - PI/2
      const dotRelNormal = dot(dirRel, normal);
      const theta = Math.acos(Math.max(-1, Math.min(1, dotRelNormal)));
      const alpha = theta - Math.PI / 2;

      // Lift Coefficient (standard frisbee aerodynamic model with stall clamping at ~28 degrees)
      const alphaClamped = Math.max(-0.5, Math.min(0.5, alpha));
      const Cl0 = 0.1;
      const Cla = 1.4;
      const Cl = Cl0 + Cla * alphaClamped;

      // Drag Coefficient
      const Cd0 = 0.08;
      const Cda = 2.4;
      const Cd = Cd0 + Cda * Math.pow(alpha, 2);

      // Lift magnitude
      const liftMag = 0.5 * RHO * speedRel * speedRel * area * Cl;
      // Drag magnitude
      const dragMag = 0.5 * RHO * speedRel * speedRel * area * Cd;

      // Lift direction is perpendicular to relative velocity, in the plane of the normal and velocity
      let liftDir = subtract(normal, multiplyScalar(dirRel, dotRelNormal));
      const liftDirMag = magnitude(liftDir);
      if (liftDirMag > 0.001) {
        liftDir = multiplyScalar(liftDir, 1 / liftDirMag);
      } else {
        liftDir = { x: 0, y: 1, z: 0 };
      }

      const fLift = multiplyScalar(liftDir, liftMag);
      const fDrag = multiplyScalar(dirRel, -dragMag);

      force = add(force, fLift);
      force = add(force, fDrag);

      // Spin decay and gyroscopic stability
      spin = spin * Math.exp(-0.1 * dt);

      // Gyroscopic stability keeps the disc orientation stable.
      const spinStability = Math.min(1.0, Math.abs(spin) / (10 * 2 * Math.PI)); // fully stable at 10 rps
      const spinSign = Math.sign(spin) || 1;
      
      // Aerodynamic torque causes rolling and pitching moment (precession)
      const pitchMoment = 0.05 * (0.5 * RHO * speedRel * speedRel * area * 0.2 * alphaClamped);
      
      // Apply rotation updates
      rot.y += wind.x * 0.01 * dt; 

      if (spinStability > 0.1) {
        // Precession: roll direction depends on spin sign!
        rot.z += pitchMoment * (1 - spinStability) * dt * 2.0 * spinSign; 
        rot.x += (pitchMoment * spinStability * 0.2) * dt * spinSign;
      } else {
        // Unstable: tumbles!
        rot.x += (pitchMoment * 5.0) * dt;
        rot.z += (Math.random() - 0.5) * 5.0 * dt;
      }

      // Visual spin yaw accumulation (clockwise is negative rotation around Y)
      rot.y -= spin * dt * 0.5;

    } else {
      // --- Baguette Spear Physics ---
      mass = 0.28; // heavier, holds momentum
      area = 0.004; // cross-section (~7cm diameter)
      const length = 0.65; // baguette length

      const { forward } = getAxesFromRotation(rot);

      // Angle of attack (baguette alignment with velocity)
      const dotRelForward = dot(dirRel, forward);
      const angle = Math.acos(Math.max(-1, Math.min(1, dotRelForward)));

      // Drag is minimal when aligned, large when sideways
      const Cd_aligned = 0.12;
      const Cd_sideways = 0.95;
      const Cd = Cd_aligned * Math.pow(Math.cos(angle), 2) + Cd_sideways * Math.pow(Math.sin(angle), 2);

      const dragMag = 0.5 * RHO * speedRel * speedRel * area * Cd;
      const fDrag = multiplyScalar(dirRel, -dragMag);

      force = add(force, fDrag);

      // Aerodynamic torque: Baguette aligns itself to its velocity vector (like arrow feathers)
      // Torque is proportional to speed^2 * sin(angle)
      const alignmentSpeed = 10.0; // speed at which it aligns quickly
      const torqueMag = 3.0 * (speedRel / alignmentSpeed) * Math.sin(angle);
      
      // Let's rotate 'forward' towards 'dirRel'
      // We can achieve this by interpolating the pitch and yaw towards the velocity direction
      const velPitch = Math.asin(dirRel.y);
      const velYaw = Math.atan2(dirRel.x, dirRel.z);

      const lerpFactor = Math.min(1.0, torqueMag * dt * 2.0);
      
      // Smoothly interpolate pitch (rot.x) and yaw (rot.y) to match velocity vector
      // Angle wrap-around is ignored since launch is forward (yaw ~0)
      rot.x += (velPitch - rot.x) * lerpFactor;
      rot.y += (velYaw - rot.y) * lerpFactor;
      // Baguette rolls slightly for visual appeal
      rot.z += 0.5 * dt; 
    }
  }

  // Acceleration
  const acc = multiplyScalar(force, 1 / mass);

  // Update velocity
  vel = add(vel, multiplyScalar(acc, dt));

  // Update position
  pos = add(pos, multiplyScalar(vel, dt));

  // Trail collection (limit frequency to avoid huge arrays)
  const lastTrail = state.trail[state.trail.length - 1];
  const distSq = (pos.x - lastTrail.x) ** 2 + (pos.y - lastTrail.y) ** 2 + (pos.z - lastTrail.z) ** 2;
  let trail = [...state.trail];
  if (distSq > 0.5 && state.isActive) {
    trail.push({ ...pos });
    if (trail.length > 300) {
      trail.shift();
    }
  }

  // Ground collision check
  let isActive = true;
  let isStuck = false;
  if (pos.y <= 0) {
    pos.y = 0;
    isActive = false;
    isStuck = true;
    vel = { x: 0, y: 0, z: 0 };
    // Add final position to trail
    trail.push({ ...pos });
  }

  const speed = magnitude(vel);
  const distance = pos.z; // travel along main axis

  return {
    position: pos,
    velocity: vel,
    rotation: rot,
    spin,
    isActive,
    isStuck,
    distance: Math.max(0, distance),
    maxHeight: Math.max(state.maxHeight, pos.y),
    maxSpeed: Math.max(state.maxSpeed, speed),
    time: state.time + dt,
    trail
  };
}

export function getPredictedTrajectory(
  launchAngleDeg: number,
  launchSpeedMs: number,
  launchHeightM: number,
  spinRps: number,
  sideAngleDeg: number,
  type: 'naan' | 'baguette',
  wind: WindState,
  maxSteps: number = 80,
  dt: number = 0.05
): Vector3D[] {
  let state = createInitialState(launchAngleDeg, launchSpeedMs, launchHeightM, spinRps, sideAngleDeg);
  const points: Vector3D[] = [{ ...state.position }];
  
  for (let i = 0; i < maxSteps; i++) {
    state = updateFlightStep(state, dt, type, wind);
    points.push({ ...state.position });
    if (!state.isActive) break;
  }
  
  return points;
}
