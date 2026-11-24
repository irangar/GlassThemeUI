"use client";

import { useEffect, useLayoutEffect, useRef, type ButtonHTMLAttributes } from "react";
import { volumetricLiquidGlass, type OpticalMaterial, type OpticalProfile, type OpticalShape } from "@/lib/optics-material";
import { useOpticsScene } from "./optics-provider";

type SurfaceProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  material?: Partial<OpticalMaterial>;
  opticalProfile?: OpticalProfile;
  opticalShape?: OpticalShape;
  debugView?: number;
};

export function LiquidGlassSurface({
  children,
  className = "",
  material,
  opticalProfile = "auto",
  opticalShape = "squircle",
  debugView = 0,
  ...props
}: SurfaceProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useOpticsScene();
  const options = useRef({
    material: volumetricLiquidGlass, profile: opticalProfile, shape: opticalShape, debugView,
  });

  useLayoutEffect(() => {
    options.current = {
      material: { ...volumetricLiquidGlass, ...material }, profile: opticalProfile, shape: opticalShape, debugView,
    };
    scene?.invalidate();
  });

  useLayoutEffect(() => {
    if (!scene || !ref.current || !canvas.current) return;
    return scene.register(ref.current, canvas.current, () => options.current);
  }, [scene]);

  useEffect(() => {
    if (scene) return;
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    const positionLens = () => {
      const bounds = element.getBoundingClientRect();
      element.style.setProperty("--lens-x", `${-bounds.left}px`);
      element.style.setProperty("--lens-y", `${-bounds.top}px`);
      element.style.setProperty("--viewport-width", `${window.innerWidth}px`);
      element.style.setProperty("--viewport-height", `${window.innerHeight}px`);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(positionLens);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(document.documentElement);
    observer.observe(element);
    positionLens();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);
    };
  }, [scene]);

  return (
    <button ref={ref} type="button" className={`glass-surface ${className}`} {...props}>
      <span className="glass-legacy" aria-hidden="true">
        <span className="glass-refraction">
          <span className="glass-scene" />
        </span>
        <span className="glass-tint" />
      </span>
      <span className="glass-rim" aria-hidden="true" />
      {scene && <canvas ref={canvas} className="glass-volume" aria-hidden="true" />}
      <span className="glass-content">{children}</span>
    </button>
  );
}

export { LiquidGlassSurface as GlassSurface };

export function GlassFilter() {
  return (
    <svg className="filter-definitions" aria-hidden="true" focusable="false">
      <defs>
        <filter id="liquid-refraction" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="12" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="2" result="smoothNoise" />
          <feDisplacementMap in="SourceGraphic" in2="smoothNoise" scale="28" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
