"use client";

import { Suspense, useMemo } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, Stage, Html } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import * as THREE from "three";

type STLViewerProps = {
  fileUrl: string;
  className?: string;
};

function ViewerLoadingFallback() {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center bg-slate-950">
      <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/90 px-4 py-3 text-sm text-slate-200 shadow-lg">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-sky-400" />
        Loading scan...
      </div>
    </div>
  );
}

function CanvasLoader() {
  return (
    <Html center>
      <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/90 px-4 py-3 text-sm text-slate-200 shadow-lg">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-sky-400" />
        Parsing STL...
      </div>
    </Html>
  );
}

function STLMesh({ fileUrl }: { fileUrl: string }) {
  const geometry = useLoader(STLLoader, fileUrl);

  const prepared = useMemo(() => {
    const cloned = geometry.clone();
    cloned.computeVertexNormals();
    cloned.center();

    cloned.computeBoundingBox();
    const size = new THREE.Vector3();
    cloned.boundingBox?.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 1.8 / maxDim;

    return {
      geometry: cloned,
      scale,
    };
  }, [geometry]);

  return (
    <mesh geometry={prepared.geometry} scale={prepared.scale} castShadow receiveShadow>
      <meshStandardMaterial color="#d8dde6" metalness={0.15} roughness={0.35} />
    </mesh>
  );
}

export default function STLViewer({ fileUrl, className }: STLViewerProps) {
  return (
    <Suspense fallback={<ViewerLoadingFallback />}>
      <div
        className={
          className ??
          "h-[420px] w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950"
        }
      >
        <Canvas
          camera={{ position: [0, 0, 3.2], fov: 35 }}
          shadows
          dpr={[1, 2]}
          gl={{ antialias: true }}
        >
          <color attach="background" args={["#020617"]} />
          <Suspense fallback={<CanvasLoader />}>
            <Stage
              intensity={0.9}
              environment="city"
              preset="rembrandt"
              adjustCamera={false}
              shadows={{ type: "accumulative", bias: -0.0001 }}
            >
              <STLMesh fileUrl={fileUrl} />
            </Stage>
          </Suspense>
          <OrbitControls makeDefault enablePan enableZoom enableRotate minDistance={1} maxDistance={10} />
        </Canvas>
      </div>
    </Suspense>
  );
}
