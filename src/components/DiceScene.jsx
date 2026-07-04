import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import { TOUCH } from 'three';
import Die from './Die';
import { getGroundTexture, THEME_BY_ID, DEFAULT_THEME } from '../dice/groundTexture';

// Height of the floor the dice roll on. Shared with the Die so it can rest the
// die exactly on the surface.
export const GROUND_Y = -1.1;

/**
 * The 3D stage: a lit table whose surface restyles with the chosen theme. The
 * camera looks down at an angle so the die's top face is readable once it
 * settles. Drag to orbit (touch-friendly); zoom/pan are disabled.
 */
export default function DiceScene({ config, result, rollId, rollDir, onSettled, theme }) {
  const t = THEME_BY_ID[theme] ?? DEFAULT_THEME;
  const groundMap = getGroundTexture(t.id);

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 3.4, 4.3], fov: 45 }}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={[t.background]} />
      <fog attach="fog" args={[t.fog, 8, 20]} />

      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 7, 5]} intensity={1.6} color={t.accent} />
      <directionalLight position={[-5, 3, -4]} intensity={0.45} color="#8ab4ff" />

      <Die
        key={config.type}
        config={config}
        result={result}
        rollId={rollId}
        rollDir={rollDir}
        onSettled={onSettled}
        groundY={GROUND_Y}
      />

      {/* The table surface. */}
      <mesh position={[0, GROUND_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[9, 64]} />
        <meshStandardMaterial
          map={groundMap}
          color={t.groundColor}
          roughness={t.roughness}
          metalness={0}
        />
      </mesh>

      {/* Soft contact shadow that anchors the die to the surface. */}
      <ContactShadows
        position={[0, GROUND_Y + 0.004, 0]}
        opacity={0.5}
        scale={10}
        blur={2.6}
        far={5}
        color="#000000"
      />

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        target={[0, -0.35, 0]}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.05}
        rotateSpeed={0.6}
        // One-finger touch is left free for swipe-to-roll (mapped to PAN, which
        // is disabled, so it's a no-op); two-finger orbits on mobile. Desktop
        // mouse-drag orbit is unaffected.
        touches={{ ONE: TOUCH.PAN, TWO: TOUCH.ROTATE }}
      />
    </Canvas>
  );
}
