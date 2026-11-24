"use client";

import { createContext, useContext, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import type { OpticalBackdrop } from "@/lib/optics-backdrop";
import type { OpticalQuality } from "@/lib/optics-material";
import { OpticsScene, type OpticsStatus } from "@/lib/optics-scene";

const OpticsContext = createContext<OpticsScene | null>(null);

export function useOpticsScene() {
  return useContext(OpticsContext);
}

export function OpticsProvider({
  backdrop, backdropClassName, quality = "high", onStatus, children,
}: {
  backdrop: OpticalBackdrop;
  backdropClassName: string;
  quality?: OpticalQuality;
  onStatus?: (status: OpticsStatus) => void;
  children: ReactNode;
}) {
  const scene = useMemo(() => new OpticsScene(), []);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { gradient, imageUrl, pattern, playing, dimmed } = backdrop;
  useLayoutEffect(() => {
    if (canvas.current) return scene.attach(canvas.current, (status) => onStatus?.(status));
  }, [onStatus, scene]);
  useLayoutEffect(() => {
    scene.setBackdrop({ gradient, imageUrl, pattern, playing, dimmed }, quality);
  }, [scene, gradient, imageUrl, pattern, playing, dimmed, quality]);
  return (
    <OpticsContext.Provider value={scene}>
      <canvas ref={canvas} className={backdropClassName} aria-hidden="true" />
      {children}
    </OpticsContext.Provider>
  );
}
