import { paintBackdrop, type OpticalBackdrop } from "./optics-backdrop";
import { createOpticsGpu, type LensTile } from "./optics-gpu";
import { effectiveLensSize, smoothRange, type OpticalMaterial, type OpticalProfile, type OpticalQuality, type OpticalShape } from "./optics-material";

export type LensOptions = {
  material: OpticalMaterial;
  profile: OpticalProfile;
  shape: OpticalShape;
  debugView: number;
};

type Lens = {
  element: HTMLElement;
  canvas: CanvasRenderingContext2D;
  options: () => LensOptions;
  previous?: DOMRect;
  dragX: number;
  dragY: number;
  tiltX: number;
  tiltY: number;
  velocityX: number;
  velocityY: number;
  pressure: number;
};

export type OpticsStatus = "webgl2" | "fallback" | "starting";

export class OpticsScene {
  private lenses = new Set<Lens>();
  private stage: HTMLCanvasElement | null = null;
  private atlas: HTMLCanvasElement | null = null;
  private gpu: ReturnType<typeof createOpticsGpu> | undefined;
  private observer?: ResizeObserver;
  private motionQuery?: MediaQueryList;
  private colorsQuery?: MediaQueryList;
  private frame = 0;
  private previousTime = 0;
  private sceneTime = 0;
  private dirty = true;
  private textureDirty = true;
  private scene: OpticalBackdrop | null = null;
  private image: HTMLImageElement | null = null;
  private quality: OpticalQuality = "high";
  private status?: (value: OpticsStatus) => void;
  private reportedStatus: OpticsStatus = "starting";

  attach(stage: HTMLCanvasElement, status: (value: OpticsStatus) => void) {
    this.stage = stage;
    this.atlas = document.createElement("canvas");
    this.status = status;
    this.reportedStatus = "starting";
    this.atlas.addEventListener("webglcontextlost", this.contextLost);
    this.atlas.addEventListener("webglcontextrestored", this.contextRestored);
    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.colorsQuery = window.matchMedia("(forced-colors: active)");
    this.motionQuery.addEventListener("change", this.preferencesChanged);
    this.colorsQuery.addEventListener("change", this.preferencesChanged);
    this.observer = new ResizeObserver((entries) => {
      if (entries.some(({ target }) => target === this.stage)) this.resize();
      else this.invalidate();
    });
    this.observer.observe(stage);
    for (const lens of this.lenses) this.observer.observe(lens.element);
    window.addEventListener("resize", this.resize);
    window.addEventListener("scroll", this.invalidate, { passive: true, capture: true });
    document.addEventListener("visibilitychange", this.invalidate);
    this.resize();
    return () => {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.observer?.disconnect();
      this.observer = undefined;
      this.motionQuery?.removeEventListener("change", this.preferencesChanged);
      this.colorsQuery?.removeEventListener("change", this.preferencesChanged);
      window.removeEventListener("resize", this.resize);
      window.removeEventListener("scroll", this.invalidate, true);
      document.removeEventListener("visibilitychange", this.invalidate);
      this.atlas?.removeEventListener("webglcontextlost", this.contextLost);
      this.atlas?.removeEventListener("webglcontextrestored", this.contextRestored);
      this.gpu?.dispose();
      this.gpu = undefined;
      this.stage = null;
      this.atlas = null;
      this.status = undefined;
    };
  }

  setBackdrop(scene: OpticalBackdrop, quality: OpticalQuality) {
    const previousUrl = this.scene?.imageUrl;
    this.scene = scene;
    this.quality = quality;
    if (previousUrl !== scene.imageUrl) {
      this.image = null;
      if (scene.imageUrl) {
        const image = new Image();
        image.src = scene.imageUrl;
        image.decode().then(() => {
          if (this.scene?.imageUrl !== scene.imageUrl) return;
          this.image = image;
          this.resize();
        }).catch(() => { /* The scene gradient remains available if the image fails. */ });
      }
    }
    this.resize();
  }

  register(element: HTMLElement, surface: HTMLCanvasElement, options: () => LensOptions) {
    const canvas = surface.getContext("2d");
    if (!canvas) return;
    const lens: Lens = {
      element, canvas, options, dragX: 0, dragY: 0, tiltX: 0, tiltY: 0,
      velocityX: 0, velocityY: 0, pressure: 0,
    };
    this.lenses.add(lens);
    this.observer?.observe(element);
    this.invalidate();
    return () => {
      this.observer?.unobserve(element);
      this.lenses.delete(lens);
      this.hide(lens);
      this.invalidate();
    };
  }

  invalidate = () => {
    if (this.stage && !this.frame && !document.hidden) {
      this.frame = requestAnimationFrame(this.render);
    }
  };

  private resize = () => {
    this.dirty = true;
    this.invalidate();
  };

  private preferencesChanged = () => {
    this.sceneTime = 0;
    this.resize();
  };

  private hide(lens: Lens) {
    delete lens.element.dataset.opticalReady;
    lens.element.style.removeProperty("--volume-weight");
    lens.element.style.removeProperty("--rim-opacity");
  }

  private report(status: OpticsStatus) {
    if (this.reportedStatus === status) return;
    this.reportedStatus = status;
    this.status?.(status);
  }

  private contextLost = (event: Event) => {
    event.preventDefault();
    this.gpu = null;
    for (const lens of this.lenses) this.hide(lens);
    this.report("fallback");
  };

  private contextRestored = () => {
    this.gpu = undefined;
    this.resize();
  };

  private updateSpring(lens: Lens, bounds: DOMRect, dt: number, enabled: boolean, pressed: boolean): LensTile["motion"] {
    const previous = lens.previous;
    lens.previous = bounds;
    if (!enabled) {
      lens.dragX = lens.dragY = lens.tiltX = lens.tiltY = lens.velocityX = lens.velocityY = lens.pressure = 0;
      return [0, 0, 0, 0];
    }
    const clamp = (value: number) => Math.max(-1.4, Math.min(1.4, value));
    const active = lens.element.dataset.dragging === "true";
    const dx = previous && active ? clamp((previous.x - bounds.x) / dt * 0.0025) : 0;
    const dy = previous && active ? clamp((previous.y - bounds.y) / dt * 0.0025) : 0;
    lens.dragX += (dx - lens.dragX) * Math.min(1, dt * 22);
    lens.dragY += (dy - lens.dragY) * Math.min(1, dt * 22);
    lens.velocityX += ((lens.dragX - lens.tiltX) * 150 - lens.velocityX * 17) * dt;
    lens.velocityY += ((lens.dragY - lens.tiltY) * 150 - lens.velocityY * 17) * dt;
    lens.tiltX += lens.velocityX * dt;
    lens.tiltY += lens.velocityY * dt;
    const pressure = active || pressed ? 1 : 0;
    lens.pressure += (pressure - lens.pressure) * Math.min(1, dt * 12);
    return [lens.tiltX, lens.tiltY, lens.pressure, 0];
  }

  private render = (now: number) => {
    this.frame = 0;
    if (!this.stage || !this.atlas || !this.scene) return;
    const stageBounds = this.stage.getBoundingClientRect();
    if (!stageBounds.width || !stageBounds.height) return;
    const dt = Math.max(1 / 120, Math.min((now - this.previousTime) / 1000, 1 / 30));
    this.previousTime = now;
    const reducedMotion = Boolean(this.motionQuery?.matches);
    const forcedColors = Boolean(this.colorsQuery?.matches);
    const stageVisible = stageBounds.bottom > 0 && stageBounds.top < innerHeight;
    const animated = this.scene.pattern === "motion" && this.scene.playing !== false && stageVisible && !reducedMotion;
    if (animated) this.sceneTime += dt;

    if (this.gpu === undefined && !forcedColors) {
      try {
        this.gpu = createOpticsGpu(this.atlas);
      } catch (error) {
        console.warn("Optical renderer unavailable. Using the glass fallback.", error);
        this.gpu = null;
      }
    }
    this.report(this.gpu && !forcedColors ? "webgl2" : "fallback");
    if (this.dirty || animated) {
      const maxSize = this.gpu?.maxSize ?? 4096;
      const scale = Math.min(devicePixelRatio, this.quality === "high" ? 1.25 : 0.85,
        maxSize / Math.max(stageBounds.width, stageBounds.height));
      paintBackdrop(this.stage, stageBounds, scale, this.scene, this.image, this.sceneTime);
      this.dirty = false;
      this.textureDirty = true;
    }

    const tiles: LensTile[] = [];
    let settling = false;
    const measured = [...this.lenses].map((lens) => ({
      lens, bounds: lens.element.getBoundingClientRect(), pressed: lens.element.matches(":active"),
    }));
    for (const { lens, bounds, pressed } of measured) {
      const { material, profile, shape, debugView } = lens.options();
      const style = lens.element.style;
      style.setProperty("--lens-x", `${stageBounds.left - bounds.left}px`);
      style.setProperty("--lens-y", `${stageBounds.top - bounds.top}px`);
      style.setProperty("--viewport-width", `${stageBounds.width}px`);
      style.setProperty("--viewport-height", `${stageBounds.height}px`);
      const visible = bounds.right > 0 && bounds.left < innerWidth && bounds.bottom > 0 && bounds.top < innerHeight;
      const displaySize = effectiveLensSize(bounds.width, bounds.height);
      const maxOpticalSize = typeof profile === "object" ? profile.maxOpticalSize : undefined;
      const opticalSize = Math.min(displaySize, maxOpticalSize ?? displaySize);
      const weight = profile === "sheet" ? 0 : debugView ? 1
        : 1 - smoothRange(154, 305, opticalSize);
      if (!visible || !weight || !this.gpu || forcedColors || !bounds.width || !bounds.height) {
        this.hide(lens);
        continue;
      }
      const motion = this.updateSpring(lens, bounds, dt, material.liquidDynamicsEnabled && !reducedMotion, pressed);
      const turbulence = material.liquidDynamicsEnabled && !reducedMotion && material.liquidTurbulence > 0;
      if (turbulence || Math.abs(lens.velocityX) + Math.abs(lens.velocityY)
        + Math.abs(lens.dragX) + Math.abs(lens.dragY) + Math.abs(motion[0]) + Math.abs(motion[1]) > 0.004
        || (motion[2] > 0.004 && motion[2] < 0.996)) settling = true;
      tiles.push({ bounds, canvas: lens.canvas, material, shape, debugView, opticalScale: opticalSize / displaySize,
        motion: [motion[0], motion[1], motion[2], turbulence ? now / 1800 : 0] });
      // Large lenses pick up the original edge highlight independently of the sheet blend.
      const edgeLight = maxOpticalSize === undefined ? 0
        : smoothRange(maxOpticalSize, maxOpticalSize + 64, displaySize);
      style.setProperty("--volume-weight", String(weight));
      style.setProperty("--rim-opacity", String(debugView ? 0 : 1 - weight * (1 - edgeLight)));
      lens.element.dataset.opticalReady = "true";
    }
    if (this.gpu && tiles.length > 0) {
      if (this.textureDirty) {
        this.gpu.upload(this.stage);
        this.textureDirty = false;
      }
      this.gpu.render(tiles, stageBounds, this.quality, this.stage);
    }
    if (animated || settling) this.invalidate();
  };
}
