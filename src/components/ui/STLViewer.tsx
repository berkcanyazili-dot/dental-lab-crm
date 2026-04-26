"use client";

import { Suspense, useMemo } from "react";
import { Canvas, ThreeEvent, useLoader } from "@react-three/fiber";
import { OrbitControls, Stage, Html } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import * as THREE from "three";

export interface STLAnnotation {
  id: string;
  x: number;
  y: number;
  z: number;
  color: string;
  label?: string | null;
  noteContent?: string | null;
}

type STLViewerProps = {
  fileUrl: string;
  className?: string;
  annotations?: STLAnnotation[];
  selectedAnnotationId?: string | null;
  annotationMode?: boolean;
  onAddAnnotation?: (position: { x: number; y: number; z: number }) => void;
  onSelectAnnotation?: (annotationId: string) => void;
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

function AnnotationPins({
  annotations,
  selectedAnnotationId,
  onSelectAnnotation,
}: {
  annotations: STLAnnotation[];
  selectedAnnotationId?: string | null;
  onSelectAnnotation?: (annotationId: string) => void;
}) {
  return (
    <>
      {annotations.map((annotation) => {
        const selected = selectedAnnotationId === annotation.id;
        return (
          <group key={annotation.id} position={[annotation.x, annotation.y, annotation.z]}>
            <mesh
              onClick={(event) => {
                event.stopPropagation();
                onSelectAnnotation?.(annotation.id);
              }}
            >
              <sphereGeometry args={[selected ? 0.1 : 0.075, 16, 16]} />
              <meshStandardMaterial color={annotation.color} emissive={annotation.color} emissiveIntensity={0.45} />
            </mesh>
            {selected && (
              <mesh>
                <sphereGeometry args={[0.135, 16, 16]} />
                <meshBasicMaterial color={annotation.color} wireframe transparent opacity={0.45} />
              </mesh>
            )}
          </group>
        );
      })}
    </>
  );
}

function STLMesh({
  fileUrl,
  annotations,
  selectedAnnotationId,
  annotationMode,
  onAddAnnotation,
  onSelectAnnotation,
}: {
  fileUrl: string;
  annotations: STLAnnotation[];
  selectedAnnotationId?: string | null;
  annotationMode?: boolean;
  onAddAnnotation?: (position: { x: number; y: number; z: number }) => void;
  onSelectAnnotation?: (annotationId: string) => void;
}) {
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

  const handleMeshClick = (event: ThreeEvent<MouseEvent>) => {
    if (!annotationMode || !onAddAnnotation) {
      return;
    }

    event.stopPropagation();
    const localPoint = event.object.worldToLocal(event.point.clone());

    onAddAnnotation({
      x: Number(localPoint.x.toFixed(4)),
      y: Number(localPoint.y.toFixed(4)),
      z: Number(localPoint.z.toFixed(4)),
    });
  };

  return (
    <group scale={prepared.scale}>
      <mesh geometry={prepared.geometry} castShadow receiveShadow onClick={handleMeshClick}>
        <meshStandardMaterial color="#d8dde6" metalness={0.15} roughness={0.35} />
      </mesh>
      <AnnotationPins
        annotations={annotations}
        selectedAnnotationId={selectedAnnotationId}
        onSelectAnnotation={onSelectAnnotation}
      />
    </group>
  );
}

export default function STLViewer({
  fileUrl,
  className,
  annotations = [],
  selectedAnnotationId,
  annotationMode = false,
  onAddAnnotation,
  onSelectAnnotation,
}: STLViewerProps) {
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
              <STLMesh
                fileUrl={fileUrl}
                annotations={annotations}
                selectedAnnotationId={selectedAnnotationId}
                annotationMode={annotationMode}
                onAddAnnotation={onAddAnnotation}
                onSelectAnnotation={onSelectAnnotation}
              />
            </Stage>
          </Suspense>
          <OrbitControls makeDefault enablePan enableZoom enableRotate minDistance={1} maxDistance={10} />
          {annotationMode && (
            <Html position={[0, 1.7, 0]} center>
              <div className="rounded-lg border border-amber-500/30 bg-slate-900/95 px-3 py-2 text-xs text-amber-200 shadow-lg">
                Click the model to drop a pin
              </div>
            </Html>
          )}
        </Canvas>
      </div>
    </Suspense>
  );
}
