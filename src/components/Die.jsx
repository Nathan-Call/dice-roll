import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildDie, buildD4 } from '../dice/geometry';
import {
  getNumberTexture,
  getPipTexture,
  getGlowTexture,
} from '../dice/numberTexture';

const ROLL_DURATION = 1.7; // tumble + bounce phase, seconds
const REVEAL_DURATION = 0.6; // "here's your result" pop, seconds
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const ALT_UP = new THREE.Vector3(0, 0, 1);
const GLOW_COLOR = '#ffd66b';

// Target world frame for a face that lands pointing up: its outward normal maps
// to +Y (up) and its "up" direction maps to −Z (away from the camera), so the
// number reads right-way-up when viewed from the front-and-above camera.
const FACE_UP_BASIS = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(0, 1, 0),
  ),
);

const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
const now = () => performance.now() / 1000;

/**
 * Build the local orientation of a face as a quaternion. The face's outward
 * normal becomes local +Z and an upright direction becomes local +Y, so a
 * number plane (which faces +Z) sits flat on the face and reads upright.
 */
function faceQuaternion(normal) {
  const ref = Math.abs(normal.dot(WORLD_UP)) > 0.9 ? ALT_UP : WORLD_UP;
  const up = ref.clone().sub(normal.clone().multiplyScalar(ref.dot(normal))).normalize();
  const right = up.clone().cross(normal).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(right, up, normal),
  );
}

/**
 * A single 3D die that rolls on the ground, bounces to rest, then flashes a
 * halo on the result. Most dice land with the winning face pointing up; the d4
 * (values at its corners) lands on a face with the result vertex pointing up.
 * Rolls are triggered by bumping `rollId`.
 */
export default function Die({ config, result, rollId, onSettled, groundY = -1.1 }) {
  const groupRef = useRef();
  const glowRef = useRef();
  const anim = useRef(null);
  const idleAngle = useRef(0);

  const isD4 = !!config.cornerValues;

  // Geometry + label data. The d4 uses a corner-value model; everything else
  // uses one number per face.
  const die = useMemo(
    () => (isD4 ? buildD4() : buildDie(config.kind, config.sides)),
    [isD4, config.kind, config.sides],
  );
  const { geometry } = die;

  // Flat vertex list, used to rest the die exactly on the floor.
  const vertices = useMemo(() => {
    const pos = geometry.attributes.position;
    const list = [];
    for (let i = 0; i < pos.count; i++) {
      list.push(new THREE.Vector3().fromBufferAttribute(pos, i));
    }
    return list;
  }, [geometry]);

  const lowestY = useMemo(() => {
    const tmp = new THREE.Vector3();
    return (quat, scale) => {
      let min = Infinity;
      for (const v of vertices) {
        tmp.copy(v).applyQuaternion(quat).multiplyScalar(scale);
        if (tmp.y < min) min = tmp.y;
      }
      return min;
    };
  }, [vertices]);

  // Face orientations (non-d4), used for numbers and for landing face-up.
  const faceData = useMemo(() => {
    if (isD4) return [];
    return die.faces.map((face) => ({
      number: face.number,
      quaternion: faceQuaternion(face.normal),
      position: face.center
        .clone()
        .add(face.normal.clone().multiplyScalar(0.015)),
    }));
  }, [isD4, die]);

  const planeSize = 0.6 * config.fontScale;
  const glowSize = planeSize * 2.0;
  const glowTexture = useMemo(() => getGlowTexture(), []);

  const faceTexture = (value) =>
    config.pips
      ? getPipTexture(value, config.number)
      : getNumberTexture(value, config.number);

  // Labels to render on the die (corner labels for d4, face numbers otherwise).
  const labelMeshes = useMemo(() => {
    const src = isD4 ? die.labels : faceData;
    return src.map((l, i) => ({
      key: i,
      position: l.position,
      quaternion: l.quaternion,
      texture: faceTexture(isD4 ? l.value : l.number),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isD4, die, faceData, config.pips, config.number]);

  // Kick off a roll whenever a new roll is requested.
  useEffect(() => {
    if (rollId === 0 || result == null || !groupRef.current) return;

    let toQuat;
    let glowPos;
    let glowQuat;

    if (isD4) {
      // Land the result vertex pointing straight up (rests flat on a face).
      const winner = die.values.find((v) => v.value === result) ?? die.values[0];
      const q1 = new THREE.Quaternion().setFromUnitVectors(winner.dir, WORLD_UP);
      // Yaw so a face turns toward the camera: put another vertex at the back.
      const other = die.values.find((v) => v !== winner);
      const back = other.dir.clone().applyQuaternion(q1);
      const q2 = new THREE.Quaternion().setFromAxisAngle(
        WORLD_UP,
        Math.PI - Math.atan2(back.x, back.z),
      );
      toQuat = q2.multiply(q1);
      // Highlight the apex where the winning value clusters. Face the halo
      // toward the camera (not straight up) so it reads clearly.
      glowPos = winner.dir.clone().multiplyScalar(0.72);
      const worldFacing = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0.5, 1).normalize(),
      );
      glowQuat = toQuat.clone().invert().multiply(worldFacing);
    } else {
      const winIndex = faceData.findIndex((f) => f.number === result);
      const target = faceData[winIndex] ?? faceData[0];
      toQuat = FACE_UP_BASIS.clone().multiply(target.quaternion.clone().invert());
      glowPos = target.position;
      glowQuat = target.quaternion;
    }

    const side = Math.random() < 0.5 ? -1 : 1;
    const travelX = side * (1.8 + Math.random() * 1.0);
    const travelZ = -1.1 - Math.random() * 0.7;
    // Roll about the horizontal axis perpendicular to the travel direction so
    // the die tumbles *forward* into place (like it's rolling across the table)
    // instead of an unnatural backspin. A little random tilt keeps it lively.
    const travelDir = new THREE.Vector3(-travelX, 0, -travelZ).normalize();
    const rollAxis = new THREE.Vector3()
      .crossVectors(WORLD_UP, travelDir)
      .addScaledVector(
        new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5),
        0.35,
      )
      .normalize();
    anim.current = {
      phase: 'rolling',
      from: groupRef.current.quaternion.clone(),
      to: toQuat,
      minY: lowestY(toQuat, config.scale),
      spinAxis: rollAxis,
      spins: 3 + Math.floor(Math.random() * 2), // full forward turns
      travelX,
      travelZ,
      rollStart: now(),
      revealStart: 0,
      settledStart: 0,
      glowPos,
      glowQuat,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollId]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    const glow = glowRef.current;
    if (!group) return;
    const a = anim.current;
    const t = now();

    let pop = 1;
    let glowOpacity = 0;
    let glowScale = 1;

    if (!a) {
      // Idle: slowly turn while sitting on the floor.
      idleAngle.current += delta * 0.3;
      group.quaternion.setFromAxisAngle(WORLD_UP, idleAngle.current);
      group.position.set(0, groundY - lowestY(group.quaternion, config.scale), 0);
    } else if (a.phase === 'rolling') {
      const p = Math.min((t - a.rollStart) / ROLL_DURATION, 1);
      const ease = easeOutQuart(p);

      // Rotation: reorient toward the resting pose while spinning forward about
      // the (world) roll axis a whole number of turns — since it's an integer
      // number of full turns the spin resolves to identity exactly at rest, so
      // the die decelerates forward into place rather than unwinding backward.
      const base = a.from.clone().slerp(a.to, ease);
      const spin = new THREE.Quaternion().setFromAxisAngle(
        a.spinAxis,
        a.spins * Math.PI * 2 * ease,
      );
      group.quaternion.copy(spin.multiply(base));

      // Position: travel in while bouncing down to rest (two soft bounces).
      const bounce = 1.05 * Math.pow(1 - p, 2) * Math.abs(Math.cos(Math.PI * 2 * p));
      group.position.set(
        a.travelX * (1 - ease),
        groundY - a.minY + bounce,
        a.travelZ * (1 - ease),
      );

      if (p >= 1) {
        group.quaternion.copy(a.to);
        group.position.set(0, groundY - a.minY, 0);
        a.phase = 'revealing';
        a.revealStart = t;
        onSettled?.();
      }
    } else if (a.phase === 'revealing') {
      const r = Math.min((t - a.revealStart) / REVEAL_DURATION, 1);
      pop = 1 + 0.13 * Math.sin(Math.PI * r);
      glowScale = 0.7 + 0.6 * r;
      glowOpacity = 0.4 + 0.6 * Math.sin(Math.PI * r);
      group.position.set(0, groundY - a.minY * pop, 0);
      if (r >= 1) {
        a.phase = 'settled';
        a.settledStart = t;
      }
    } else {
      // Breathing glow that holds for 5s, then fades out over 1s.
      const held = t - a.settledStart;
      const breathe = 0.5 + 0.5 * Math.sin(t * 2.4);
      const fade = held < 5 ? 1 : Math.max(0, 1 - (held - 5));
      glowOpacity = (0.28 + 0.14 * breathe) * fade;
      glowScale = 1.28 + 0.05 * breathe;
      group.position.set(0, groundY - a.minY, 0);
    }

    group.scale.setScalar(config.scale * pop);

    if (glow) {
      if (a) {
        glow.position.copy(a.glowPos);
        glow.quaternion.copy(a.glowQuat);
        glow.scale.setScalar(glowSize * glowScale);
        glow.material.opacity = glowOpacity;
        glow.visible = glowOpacity > 0.01;
      } else {
        glow.visible = false;
      }
    }
  });

  return (
    <group ref={groupRef} scale={config.scale}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={config.body}
          flatShading
          metalness={0.25}
          roughness={0.35}
        />
      </mesh>

      {labelMeshes.map((n) => (
        <mesh key={n.key} position={n.position} quaternion={n.quaternion}>
          <planeGeometry args={[planeSize, planeSize]} />
          <meshBasicMaterial
            map={n.texture}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Highlight halo — repositioned onto the winning face/apex after a roll. */}
      <mesh ref={glowRef} visible={false} renderOrder={2}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={glowTexture}
          color={GLOW_COLOR}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
