"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { GRADIENTS } from "@/lib/backgrounds";
import { homeGlassPreset, opticalViews, volumetricLiquidGlass, type OpticalMaterial, type OpticalQuality } from "@/lib/optics-material";
import type { OpticsStatus } from "@/lib/optics-scene";
import { GlassFilter, LiquidGlassSurface } from "./glass-surface";
import { OpticsProvider } from "./optics-provider";

const scenes = [
  { id: "forest", name: "Forest", imageUrl: "/optics/forest.jpg" },
  { id: "coast", name: "Coast", imageUrl: "/optics/coast.jpg" },
  { id: "text", name: "Contrast text", pattern: "text" },
  { id: "motion", name: "Moving objects", pattern: "motion" },
] as const;

type NumericSetting = Exclude<keyof OpticalMaterial, "liquidDynamicsEnabled">;
type Slider = {
  field: NumericSetting;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
};

const settings: { name: string; sliders: Slider[] }[] = [
  {
    name: "Geometry",
    sliders: [
      { field: "shellThickness", label: "Shell thickness", min: 0.5, max: 8, step: 0.1, unit: "px" },
      { field: "liquidDepth", label: "Liquid depth", min: 2, max: 32, step: 0.5, unit: "px" },
      { field: "surfaceConvexity", label: "Front convexity", min: 0, max: 1, step: 0.01 },
      { field: "rearCurvature", label: "Rear curvature", min: 0, max: 1, step: 0.01 },
      { field: "cornerSmoothing", label: "Corner smoothing", min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    name: "Light and transmission",
    sliders: [
      { field: "glassIOR", label: "Glass IOR", min: 1, max: 1.9, step: 0.001 },
      { field: "liquidIOR", label: "Liquid IOR", min: 1, max: 1.7, step: 0.001 },
      { field: "internalReflectionStrength", label: "Internal reflection", min: 0, max: 1, step: 0.01 },
      { field: "maxReflectionBounces", label: "Reflection bounces", min: 0, max: 4, step: 1 },
      { field: "causticIntensity", label: "Caustic intensity", min: 0, max: 0.95, step: 0.01 },
      { field: "internalDiffusion", label: "Internal diffusion", min: 0, max: 10, step: 0.1, unit: "px" },
      { field: "liquidAbsorption", label: "Liquid absorption", min: 0, max: 0.15, step: 0.001 },
      { field: "surfaceRoughness", label: "Surface roughness", min: 0, max: 0.25, step: 0.005 },
      { field: "chromaticDispersion", label: "Chromatic dispersion", min: 0, max: 2, step: 0.1, unit: "px" },
    ],
  },
];

const limits = (value: number, margin: number) => Math.min(100 - margin, Math.max(margin, value));

function LensGlyph({ circle }: { circle: boolean }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.65" aria-hidden="true">
      {circle ? (
        <>
          <circle cx="24" cy="24" r="12" />
          <path d="M24 7v8m0 18v8M7 24h8m18 0h8" />
        </>
      ) : (
        <>
          <path d="M24 8c2.8 9.2 6.8 13.2 16 16-9.2 2.8-13.2 6.8-16 16-2.8-9.2-6.8-13.2-16-16 9.2-2.8 13.2-6.8 16-16Z" />
          <path d="M24 19v10m-5-5h10" />
        </>
      )}
    </svg>
  );
}

function Sample({
  stage, circle = false, size, material, debugView,
}: {
  stage: RefObject<HTMLDivElement | null>;
  circle?: boolean;
  size: number;
  material: OpticalMaterial;
  debugView: number;
}) {
  const [position, setPosition] = useState({ x: circle ? 63 : 36, y: circle ? 67 : 44 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ pointer: number; x: number; y: number } | null>(null);
  function move(x: number, y: number, button: HTMLButtonElement) {
    const area = stage.current?.getBoundingClientRect();
    if (!area?.width || !area.height) return;
    const marginX = Math.min(50, button.offsetWidth / area.width * 50);
    const marginY = Math.min(50, button.offsetHeight / area.height * 50);
    setPosition({ x: limits(x, marginX), y: limits(y, marginY) });
  }
  function start(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || drag.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = { pointer: event.pointerId, x: event.clientX - rect.left - rect.width / 2,
      y: event.clientY - rect.top - rect.height / 2 };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }
  function follow(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    const area = stage.current?.getBoundingClientRect();
    if (!active || active.pointer !== event.pointerId || !area?.width || !area.height) return;
    move((event.clientX - active.x - area.left) / area.width * 100,
      (event.clientY - active.y - area.top) / area.height * 100, event.currentTarget);
  }
  function stop(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointer !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
  }
  function nudge(event: KeyboardEvent<HTMLButtonElement>) {
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
      [event.key as "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown"];
    const area = stage.current?.getBoundingClientRect();
    if (!direction || !area?.width || !area.height) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const step = event.shiftKey ? 24 : 8;
    move((bounds.left + bounds.width / 2 - area.left + direction[0] * step) / area.width * 100,
      (bounds.top + bounds.height / 2 - area.top + direction[1] * step) / area.height * 100, event.currentTarget);
  }
  const style = { "--sample-x": `${position.x}%`, "--sample-y": `${position.y}%`, "--sample-size": `${size}px` } as CSSProperties;
  return (
    <LiquidGlassSurface
      className={`lab-sample${circle ? " lab-sample-circle" : ""}${debugView ? " lab-sample-debug" : ""}`}
      style={style}
      data-dragging={dragging}
      data-lens={circle ? "circle" : "squircle"}
      aria-label={circle ? "Move circular lens" : "Move squircle lens"}
      aria-describedby="lens-instructions"
      opticalProfile={homeGlassPreset.profile}
      opticalShape={circle ? "circle" : "squircle"}
      material={material}
      debugView={debugView}
      onPointerDown={start}
      onPointerMove={follow}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onKeyDown={nudge}
    >
      <LensGlyph circle={circle} />
    </LiquidGlassSurface>
  );
}

export function OpticalLab() {
  const [material, setMaterial] = useState<OpticalMaterial>(volumetricLiquidGlass);
  const [sceneId, setSceneId] = useState<typeof scenes[number]["id"]>("forest");
  const [quality, setQuality] = useState<OpticalQuality>("high");
  const [view, setView] = useState(0);
  const [size, setSize] = useState(148);
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState<OpticsStatus>("starting");
  const [playing, setPlaying] = useState(true);
  const stage = useRef<HTMLDivElement>(null);
  const active = scenes.find(({ id }) => id === sceneId) ?? scenes[0];
  const imageUrl = "imageUrl" in active ? active.imageUrl : undefined;
  const pattern = "pattern" in active ? active.pattern : undefined;
  const style = { "--scene-background": imageUrl ? `url("${imageUrl}")` : "linear-gradient(135deg, #152728, #46534e)" } as CSSProperties;

  function reset() {
    setMaterial(volumetricLiquidGlass);
    setView(0);
    setSize(148);
    setVersion((current) => current + 1);
  }

  return (
    <main className="optical-lab">
      <header className="lab-nav">
        <Link className="wordmark" href="/">
          <span className="brand-symbol" aria-hidden="true"><span /><span /></span>
          <span>liquid<span className="wordmark-light">glass</span><span className="brand-period">.</span></span>
        </Link>
        <Link className="lab-link" href="/">Back to playground <span aria-hidden="true">↗</span></Link>
      </header>
      <div className="lab-main">
        <header className="lab-title">
          <h1>Optical lab</h1>
          <p>Move a lens across the scene and tune how light travels through its glass and liquid layers.</p>
        </header>
        <div className="lab-layout">
          <section className="lab-preview" aria-label="Optical preview">
            <div className="lab-bar">
              <div className="lab-scenes" role="group" aria-label="Backdrop">
                {scenes.map(({ id, name }) => (
                  <button type="button" key={id} aria-pressed={id === sceneId} onClick={() => setSceneId(id)}>{name}</button>
                ))}
              </div>
              {pattern === "motion" && (
                <button type="button" className="lab-link lab-motion" onClick={() => setPlaying(!playing)}>
                  {playing ? "Pause motion" : "Play motion"}
                </button>
              )}
            </div>
            <div className="lab-stage" ref={stage} style={style} data-pattern={pattern}>
              <GlassFilter />
              <OpticsProvider backdrop={{ gradient: GRADIENTS[2], imageUrl, pattern, playing }}
                backdropClassName="lab-backdrop" quality={quality} onStatus={setStatus}>
                <Sample key={`square-${version}`} stage={stage} size={size} material={material} debugView={view} />
                <Sample key={`circle-${version}`} stage={stage} size={92} material={material} debugView={view} circle />
              </OpticsProvider>
            </div>
            <footer className="lab-caption">
              <span id="lens-instructions">Drag a lens or move it with the arrow keys.</span>
              <span className="lab-status" data-status={status} role="status">
                {status === "webgl2" ? "WebGL 2" : status === "fallback" ? "Fallback glass" : "Starting renderer"}
              </span>
            </footer>
          </section>
          <aside className="lab-inspector" aria-label="Material settings">
            <header className="lab-inspector-heading">
              <h2>Material</h2>
              <button type="button" className="lab-link" onClick={reset}>Reset</button>
            </header>
            <div className="lab-settings">
              <div className="lab-selects">
                <label>View
                  <select value={view} disabled={status === "fallback"} onChange={(event) => setView(Number(event.target.value))}>
                    {opticalViews.map((name, index) => <option key={name} value={index}>{name}</option>)}
                  </select>
                </label>
                <label>Quality
                  <select value={quality} onChange={(event) => setQuality(event.target.value as OpticalQuality)}>
                    <option value="high">High</option>
                    <option value="performance">Performance</option>
                  </select>
                </label>
              </div>
              <label className="lab-slider">
                <span>Lens size <output>{size} px</output></span>
                <input type="range" min="60" max="340" value={size} aria-label="Lens size"
                  onChange={(event) => setSize(event.target.valueAsNumber)} />
              </label>
              {settings.map((section) => (
                <fieldset key={section.name} className="lab-fieldset">
                  <legend>{section.name}</legend>
                  {section.sliders.map(({ field, label, min, max, step, unit }) => (
                    <label className="lab-slider" key={field}>
                      <span>{label} <output>{material[field]}{unit ? ` ${unit}` : ""}</output></span>
                      <input type="range" min={min} max={max} step={step} value={material[field]} aria-label={label}
                        onChange={(event) => {
                          const value = event.target.valueAsNumber;
                          setMaterial((current) => ({ ...current, [field]: value }));
                        }} />
                    </label>
                  ))}
                </fieldset>
              ))}
              <label className="lab-check">
                <input type="checkbox" checked={material.liquidDynamicsEnabled}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setMaterial((current) => ({ ...current, liquidDynamicsEnabled: checked }));
                  }} />
                Liquid movement during dragging
              </label>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
