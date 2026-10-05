"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function carShape() {
  const s = new THREE.Shape();
  s.moveTo(-2.2, 0.15);
  s.lineTo(-2.25, 0.75);
  s.bezierCurveTo(-2.25, 0.95, -1.95, 1.0, -1.5, 1.05);
  s.lineTo(-0.85, 1.55);
  s.bezierCurveTo(-0.65, 1.72, -0.35, 1.8, 0.05, 1.8);
  s.lineTo(0.85, 1.8);
  s.bezierCurveTo(1.3, 1.8, 1.55, 1.6, 1.85, 1.2);
  s.lineTo(2.15, 1.05);
  s.bezierCurveTo(2.4, 1.0, 2.45, 0.8, 2.45, 0.6);
  s.lineTo(2.45, 0.15);
  s.lineTo(-2.2, 0.15);
  return s;
}

function glassShape() {
  const s = new THREE.Shape();
  s.moveTo(-1.25, 1.08);
  s.lineTo(-0.75, 1.5);
  s.bezierCurveTo(-0.55, 1.65, -0.3, 1.7, 0.05, 1.7);
  s.lineTo(0.8, 1.7);
  s.bezierCurveTo(1.15, 1.7, 1.35, 1.52, 1.6, 1.2);
  s.lineTo(1.7, 1.08);
  s.lineTo(-1.25, 1.08);
  return s;
}

function Wheel({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0.32, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh><cylinderGeometry args={[0.42, 0.42, 0.34, 32]} /><meshStandardMaterial color="#12141a" roughness={0.8} /></mesh>
      <mesh position={[0, 0.0, 0]}><cylinderGeometry args={[0.26, 0.26, 0.36, 24]} /><meshStandardMaterial color="#c9a227" metalness={0.9} roughness={0.25} /></mesh>
    </group>
  );
}

function Car({ animate }: { animate: boolean }) {
  const group = useRef<THREE.Group>(null);
  const body = useMemo(() => new THREE.ExtrudeGeometry(carShape(), { depth: 1.5, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.1, bevelSegments: 4, curveSegments: 20 }), []);
  const glass = useMemo(() => new THREE.ExtrudeGeometry(glassShape(), { depth: 1.56, bevelEnabled: false }), []);
  useFrame((_, dt) => {
    if (animate && group.current) group.current.rotation.y += dt * 0.35;
  });
  return (
    <group ref={group} rotation={[0.1, -0.7, 0]} position={[0, -0.5, 0]}>
      <group position={[0, 0, -0.75]}>
        <mesh geometry={body}><meshPhysicalMaterial color="#2a66e0" metalness={0.55} roughness={0.28} clearcoat={1} clearcoatRoughness={0.08} /></mesh>
        <mesh geometry={glass} position={[0, 0, -0.03]}><meshPhysicalMaterial color="#0a1530" metalness={0.2} roughness={0.05} transparent opacity={0.85} /></mesh>
      </group>
      <Wheel x={-1.3} z={0.85} /><Wheel x={-1.3} z={-0.85} /><Wheel x={1.45} z={0.85} /><Wheel x={1.45} z={-0.85} />
      <mesh position={[0, 0.17, 0]}><boxGeometry args={[4.6, 0.04, 1.4]} /><meshStandardMaterial color="#c9a227" metalness={1} roughness={0.3} /></mesh>
    </group>
  );
}

function Podium() {
  return (
    <mesh position={[0, -0.62, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[3.0, 3.14, 96]} />
      <meshBasicMaterial color="#c9a227" transparent opacity={0.9} />
    </mesh>
  );
}

export default function CarScene({ animate }: { animate: boolean }) {
  return (
    <Canvas
      frameloop={animate ? "always" : "demand"}
      dpr={animate ? [1, 1.75] : 1}
      camera={{ position: [0, 1.6, 6.2], fov: 38 }}
      gl={{ antialias: animate, powerPreference: "high-performance", alpha: true }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <hemisphereLight args={["#dbe7ff", "#274a9a", 1.6]} />
      <directionalLight position={[4, 6, 4]} intensity={3.4} color="#ffffff" />
      <pointLight position={[-4, 2, -3]} intensity={30} color="#c9a227" />
      <pointLight position={[3, 1, 5]} intensity={40} color="#7aa5ff" />
      <directionalLight position={[-5, 3, 4]} intensity={1.6} color="#ffffff" />
      <Car animate={animate} />
      <Podium />
    </Canvas>
  );
}
