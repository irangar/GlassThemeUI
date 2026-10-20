"use client";

import { useEffect, useRef, type ButtonHTMLAttributes } from "react";

export function GlassSurface({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
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
  }, []);

  return (
    <button ref={ref} type="button" className={`glass-surface ${className}`} {...props}>
      <span className="glass-refraction" aria-hidden="true">
        <span className="glass-scene" />
      </span>
      <span className="glass-tint" aria-hidden="true" />
      <span className="glass-rim" aria-hidden="true" />
      <span className="glass-content">{children}</span>
    </button>
  );
}

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
