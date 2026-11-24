/** Experimental calibration. Lengths are in CSS pixels; absorption is per CSS pixel. */
export const volumetricLiquidGlass = {
  airIOR: 1,
  glassIOR: 1.5,
  liquidIOR: 1.333,
  shellThickness: 2,
  liquidDepth: 12,
  surfaceConvexity: 0.9,
  rearCurvature: 0.52,
  internalReflectionStrength: 0.55,
  maxReflectionBounces: 2,
  causticIntensity: 0.35,
  internalDiffusion: 2.5,
  surfaceRoughness: 0.035,
  transmission: 0.96,
  liquidAbsorption: 0.015,
  chromaticDispersion: 0.4,
  cornerSmoothing: 0.95,
  bevelRatio: 0.4,
  decorativeBorderWidth: 0,
  liquidTurbulence: 0,
  liquidDynamicsEnabled: false,
};

export type OpticalMaterial = typeof volumetricLiquidGlass;
export type OpticalQuality = "high" | "performance";
export type OpticalProfile = "auto" | "sheet" | { maxOpticalSize: number };
export type OpticalShape = "squircle" | "circle";

export const homeGlassPreset = {
  quality: "performance",
  profile: { maxOpticalSize: 222 },
  material: {
    ...volumetricLiquidGlass,
    shellThickness: 8,
    liquidDepth: 32,
    surfaceConvexity: 1,
    rearCurvature: 1,
    cornerSmoothing: 1,
    glassIOR: 1.9,
    liquidIOR: 1.61,
    internalReflectionStrength: 0.31,
    maxReflectionBounces: 3,
    causticIntensity: 0,
    internalDiffusion: 0,
    liquidAbsorption: 0,
    surfaceRoughness: 0,
    chromaticDispersion: 0,
    liquidDynamicsEnabled: false,
  },
} satisfies { quality: OpticalQuality; profile: OpticalProfile; material: OpticalMaterial };

export const opticalViews = [
  "Final composite",
  "Air → front glass",
  "Front glass → liquid",
  "Liquid → rear glass",
  "Rear glass → air",
  "Exit ray direction",
  "Internal reflection",
  "Ray concentration",
  "Liquid absorption",
] as const;

export function effectiveLensSize(width: number, height: number) {
  return Math.max(Math.sqrt(width * height), Math.max(width, height) * 0.67);
}

export function smoothRange(start: number, end: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}
